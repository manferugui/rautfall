/**
 * Escena principal de Phaser para Rautfall.
 *
 * Responsabilidades:
 * - Crear y gestionar el motor de juego (`@rautfall/game-engine`).
 * - Capturar teclado y traducirlo a StepInput.
 * - Adaptar tiempo real a pasos lógicos fijos.
 * - Renderizar tablero fijo y pieza activa desde snapshots del motor.
 * - Drenar eventos del motor.
 * - Notificar a Vue mediante callback con el resumen mínimo.
 * - Soportar reset desde teclado (R) y desde controlador externo.
 * - No contiene reglas de dominio (colisiones, SRS, gravedad, DAS, ARR, soft drop, etc.).
 */

import Phaser from 'phaser';
import { createGameEngine, type GameEngine, type PieceType } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import type { GamePresentationState } from '../types';
import { computeSteps } from '../time-adapter';
import { buildStepInput, type KeyState } from '../input-buffer';
import { logDebug, snapshotResult, snapshotFrameEvents, isAdapterRelevant, shouldLogEngineResult, hasImportantEngineEvent } from '../input-debug';
import {
  CELL_SIZE,
  HIDDEN_ROWS,
  boardXToCanvas,
  boardYToCanvas,
  isRowVisible,
} from '../coordinates';

const FIXED_SEED = 42;

const PIECE_COLORS: Record<PieceType, number> = {
  I: 0x00d4ff,
  O: 0xffd700,
  T: 0x9b59b6,
  S: 0x2ecc71,
  Z: 0xe74c3c,
  J: 0x3498db,
  L: 0xf39c12,
};

type ConsumedFlags = {
  horizontal: boolean;
  clockwise: boolean;
  counterclockwise: boolean;
  hardDrop: boolean;
};

export type GameSceneCallbacks = {
  onStateUpdate: (state: GamePresentationState) => void;
};

export class GameScene extends Phaser.Scene {
  private engine!: GameEngine;
  private graphics!: Phaser.GameObjects.Graphics;
  private accumulator = 0;
  private lastState: GamePresentationState | null = null;
  private callbacks!: GameSceneCallbacks;
  private consumedThisFrame: ConsumedFlags = {
    horizontal: false,
    clockwise: false,
    counterclockwise: false,
    hardDrop: false,
  };

  private cursors!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
    r: Phaser.Input.Keyboard.Key;
  };

  /**
   * Flanco horizontal pendiente. Se establece en el evento `keydown` real
   * (filtrando auto-repeat del navegador) y se consume en el primer paso
   * lógico disponible. Solo puede tomar un valor a la vez: la última
   * pulsación real gana.
   */
  private pendingHorizontal: 'left' | 'right' | null = null;

  /**
   * Listeners registrados para poder retirarlos al destruir la escena.
   */
  private horizontalListeners: (() => void) | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { callbacks: GameSceneCallbacks }): void {
    this.callbacks = data.callbacks;
  }

  create(): void {
    this.resetEngine();

    this.graphics = this.add.graphics();
    this.graphics.setPosition(0, 0);

    const kb = this.input.keyboard!;
    this.cursors = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
    this.lastState = null;
    this.pendingHorizontal = null;

    // Suscribir shutdown() una sola vez a los eventos de ciclo de vida
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // Registrar listener de keydown para el orden real de pulsaciones horizontales.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return; // Ignorar auto-repeat del navegador
      const before = this.pendingHorizontal;
      if (event.code === 'ArrowLeft') {
        this.pendingHorizontal = 'left';
      } else if (event.code === 'ArrowRight') {
        this.pendingHorizontal = 'right';
      }
      logDebug({
        source: 'keyboard',
        event: 'keydown',
        code: event.code,
        repeat: event.repeat,
        timestamp: performance.now(),
        pendingHorizontalBefore: before,
        pendingHorizontalAfter: this.pendingHorizontal,
      });
    };

    this.input.keyboard!.on('keydown', onKeyDown);

    // Registrar keyup para teclas horizontales y de soft drop
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight' && event.code !== 'ArrowDown') return;
      logDebug({
        source: 'keyboard',
        event: 'keyup',
        code: event.code,
        repeat: false,
        timestamp: performance.now(),
        pendingHorizontalBefore: this.pendingHorizontal,
        pendingHorizontalAfter: this.pendingHorizontal,
      });
    };
    this.input.keyboard!.on('keyup', onKeyUp);

    // Guardar referencia para limpiar al destruir (ahora retira ambos listeners)
    this.horizontalListeners = () => {
      this.input.keyboard!.off('keydown', onKeyDown);
      this.input.keyboard!.off('keyup', onKeyUp);
    };

    logDebug({ source: 'lifecycle', event: 'create' });
  }

  /**
   * Se llama cuando la escena se destruye o se cierra (suscrito con once()).
   * Limpia listeners y estado pendiente.
   */
  shutdown(): void {
    this.pendingHorizontal = null;

    logDebug({ source: 'lifecycle', event: 'shutdown' });

    // Retirar las propias suscripciones de ciclo de vida (seguridad adicional)
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // Retirar listener horizontal de keydown y keyup
    if (this.horizontalListeners) {
      this.horizontalListeners();
      this.horizontalListeners = null;
    }
  }

  update(_time: number, delta: number): void {
    // Reiniciar banderas de consumo al empezar el frame
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };

    if (Phaser.Input.Keyboard.JustDown(this.cursors.r)) {
      this.resetEngine();
      this.notifyState();
      return;
    }

    const status = this.engine.getSnapshot().status;
    if (status === 'gameOver') {
      this.renderFrame();
      this.engine.drainEvents();
      return;
    }

    const fixedStepMs = prototypeConfig.fixedStepMs;
    const [stepsToExecute, newAcc] = computeSteps(this.accumulator, delta, fixedStepMs);
    this.accumulator = newAcc;

    const keys = this.readKeys();

    for (let i = 0; i < stepsToExecute; i++) {
      if (this.engine.getSnapshot().status === 'gameOver') break;

      const [input, updatedConsumed] = buildStepInput(
        i === 0 ? keys : this.emptyInput(),
        i === 0
          ? this.consumedThisFrame
          : { horizontal: true, clockwise: true, counterclockwise: true, hardDrop: true },
      );

      if (i === 0) {
        this.consumedThisFrame = updatedConsumed;
      }

      if (this.engine.getSnapshot().status === 'running') {
        const snapBefore = this.engine.getSnapshot();
        const xBefore = snapBefore.activePiece?.x ?? 0;
        const yBefore = snapBefore.activePiece?.y ?? 0;

        const adapterEntry = {
          source: 'adapter' as const,
          logicalStep: snapBefore.step,
          stepIndex: i,
          totalSteps: stepsToExecute,
          leftHeld: input.leftHeld,
          rightHeld: input.rightHeld,
          leftPressed: input.leftPressed,
          rightPressed: input.rightPressed,
          softDropHeld: input.softDropHeld,
          rotateClockwise: input.rotateClockwise ?? false,
          rotateCounterclockwise: input.rotateCounterclockwise ?? false,
          hardDrop: input.hardDrop,
          pendingHorizontal: keys.horizontalPressed,
          consumedHorizontal: this.consumedThisFrame.horizontal,
        };

        const hadRelevantInput = isAdapterRelevant(adapterEntry);

        if (hadRelevantInput) {
          logDebug(adapterEntry);
        }

        this.engine.step(input);

        const snapAfter = this.engine.getSnapshot();
        const pieceAfter = snapAfter.activePiece?.type ?? null;
        const xAfter = snapAfter.activePiece?.x ?? xBefore;
        const yAfter = snapAfter.activePiece?.y ?? yBefore;

        if (shouldLogEngineResult({
          hadRelevantInput,
          softDropHeld: input.softDropHeld,
          hardDrop: input.hardDrop,
          xBefore,
          xAfter,
          yBefore,
          yAfter,
          pieceBefore: snapBefore.activePiece?.type ?? null,
          pieceAfter,
          statusBefore: snapBefore.status,
          statusAfter: snapAfter.status,
          hadEdgeAction: input.leftPressed || input.rightPressed || input.rotateClockwise === true || input.rotateCounterclockwise === true || input.hardDrop,
        })) {
          logDebug(snapshotResult(
            snapAfter.step,
            pieceAfter,
            xBefore,
            xAfter,
            yBefore,
            yAfter,
            snapAfter.status,
          ));
        }
      }
    }

    this.renderFrame();
    const frameEvents = this.engine.drainEvents();
    const frameEventTypes = frameEvents.map(e => e.type);
    if (hasImportantEngineEvent(frameEventTypes)) {
      const snap = this.engine.getSnapshot();
      logDebug(snapshotFrameEvents(
        snap.step,
        frameEventTypes,
        snap.activePiece?.type ?? null,
        snap.status,
      ));
    }
    this.notifyState();
  }

  resetGame(): void {
    this.resetEngine();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
    this.notifyState();
    logDebug({ source: 'lifecycle', event: 'reset – resetGame' });
  }

  private resetEngine(): void {
    this.engine = createGameEngine({ seed: FIXED_SEED, config: prototypeConfig });
    this.engine.drainEvents();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
    this.pendingHorizontal = null;
    logDebug({ source: 'lifecycle', event: 'reset – engine' });
  }

  /**
   * Lee el estado de teclas para este frame.
   *
   * El flanco horizontal se determina a partir del último evento `keydown`
   * real registrado desde el frame anterior. Si la tecla correspondiente
   * ya no está mantenida (se soltó antes de consumir), el flanco se descarta
   * para no violar la validación `pressed requiere held` del motor.
   */
  private readKeys(): KeyState {
    let horizontalPressed: 'left' | 'right' | null = null;
    let leftHeld = this.cursors.left.isDown;
    let rightHeld = this.cursors.right.isDown;

    if (this.pendingHorizontal !== null) {
      // Se recibió un keydown real desde la última vez. Siempre entregar el flanco,
      // incluso si la tecla ya no está físicamente mantenida (pulsación ultracorta
      // dentro del mismo tick). Forzar el held correspondiente para que el motor
      // acepte pressed+held.
      if (this.pendingHorizontal === 'left') {
        horizontalPressed = 'left';
        leftHeld = true;
      } else {
        horizontalPressed = 'right';
        rightHeld = true;
      }
      this.pendingHorizontal = null; // consumido para el frame
    }

    return {
      horizontalPressed,
      leftHeld,
      rightHeld,
      justPressedUp: Phaser.Input.Keyboard.JustDown(this.cursors.up),
      justPressedZ: Phaser.Input.Keyboard.JustDown(this.cursors.z),
      justPressedSpace: Phaser.Input.Keyboard.JustDown(this.cursors.space),
      softDropHeld: this.cursors.down.isDown,
    };
  }

  /**
   * Genera un KeyState para pasos lógicos adicionales dentro del mismo frame.
   * Preserva el estado mantenido de teclas horizontales y soft drop
   * porque el motor necesita conocer el valor real de `leftHeld`/`rightHeld`
   * para continuar o limpiar la secuencia DAS/ARR. El flanco horizontal
   * se bloquea (null) para no repetir la pulsación; lo mismo para rotación
   * y hard drop, que se consumen con `consumedThisFrame`.
   */
  private emptyInput(): KeyState {
    return {
      horizontalPressed: null,
      leftHeld: this.cursors.left.isDown,
      rightHeld: this.cursors.right.isDown,
      justPressedUp: false,
      justPressedZ: false,
      justPressedSpace: false,
      softDropHeld: this.cursors.down.isDown,
    };
  }

  private renderFrame(): void {
    const snap = this.engine.getSnapshot();

    this.graphics.clear();

    // Dibujar tablero fijo (filas visibles 4-23)
    for (let y = HIDDEN_ROWS; y < 24; y++) {
      for (let x = 0; x < 10; x++) {
        const cell = snap.board[y]![x];
        const canvasX = boardXToCanvas(x);
        const canvasY = boardYToCanvas(y);
        if (cell !== null) {
          this.graphics.fillStyle(PIECE_COLORS[cell as PieceType], 1);
          this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
          this.graphics.lineStyle(1, 0x000000, 0.3);
          this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
        } else {
          this.graphics.fillStyle(0x1a1a2e, 1);
          this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
          this.graphics.lineStyle(1, 0x2a2a3e, 1);
          this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Superponer pieza activa
    if (snap.activePiece) {
      const color = PIECE_COLORS[snap.activePiece.type as PieceType];
      for (const cell of snap.activePiece.cells) {
        if (!isRowVisible(cell.y)) continue;
        const canvasX = boardXToCanvas(cell.x);
        const canvasY = boardYToCanvas(cell.y);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
        this.graphics.lineStyle(1, 0x000000, 0.3);
        this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  private notifyState(): void {
    const snap = this.engine.getSnapshot();
    const newState: GamePresentationState = {
      status: snap.status,
      step: snap.step,
      elapsedMs: snap.elapsedMs,
      nextPieces: [...snap.nextPieces],
    };

    if (
      this.lastState &&
      this.lastState.status === newState.status &&
      this.lastState.step === newState.step &&
      this.lastState.elapsedMs === newState.elapsedMs &&
      this.lastState.nextPieces.length === newState.nextPieces.length &&
      this.lastState.nextPieces.every((p, i) => p === newState.nextPieces[i])
    ) {
      return;
    }

    this.lastState = newState;
    this.callbacks.onStateUpdate(newState);
  }
}
