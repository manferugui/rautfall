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
 * - Gestionar pausa, reanudación y reinicio coordinados (0008).
 * - Neutralizar entrada al pausar y rearmar al reanudar/reiniciar.
 * - No contiene reglas de dominio (colisiones, SRS, gravedad, DAS, ARR, soft drop, hold, etc.).
 */

import Phaser from 'phaser';
import { createGameEngine, type GameEngine, type PieceType } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import type { GameMode, GamePresentationState, BotDevDiagnostic } from '../types';
import { computeSteps } from '../time-adapter';
import { buildStepInput, type KeyState } from '../input-buffer';
import { logDebug, snapshotResult, snapshotFrameEvents, isAdapterRelevant, shouldLogEngineResult, hasImportantEngineEvent } from '../input-debug';
import { computeSessionStatus, canTogglePause } from '../session-status';
import { isTSpinDemoActive, createTSpinDemoEngine } from '../tspin-demo';
import { isSabotageDemoActive, createSabotageDemoEngine } from '../sabotage-demo';
import { isOverloadDemoActive, createOverloadDemoEngine } from '../overload-demo';
import { isGarbageDemoActive, createGarbageDemoEngine } from '../garbage-demo';
import { isPolarityDemoActive, createPolarityDemoEngine } from '../polarity-demo';
import { isBattleDemoActive, createBattleDemoSession } from '../battle-demo';
import { createBattleSession, createDeterministicBot, type BattleSession, type DeterministicBot } from '@rautfall/battle-engine';
import { getLevelDemoTarget, createLevelDemoEngine } from '../level-demo';
import { armReleaseGuard, clearReleaseGuardKey, resolveHeld, NO_RELEASE_GUARD, type ReleaseGuard } from '../input-release-guard';
import {
  CELL_SIZE,
  HIDDEN_ROWS,
  boardXToCanvas,
  boardYToCanvas,
  isRowVisible,
} from '../coordinates';
import { mapEngineToOpponentPresentation } from '../opponent-mapper';
import { getAudioManager } from '../../audio';

const FIXED_SEED = 42;

const PIECE_COLORS: Record<PieceType | 'garbage', number> = {
  I: 0x00d4ff,
  O: 0xffd700,
  T: 0x9b59b6,
  S: 0x2ecc71,
  Z: 0xe74c3c,
  J: 0x3498db,
  L: 0xf39c12,
  garbage: 0x555555,
};

type ConsumedFlags = {
  horizontal: boolean;
  clockwise: boolean;
  counterclockwise: boolean;
  hardDrop: boolean;
  hold: boolean;
  triggerSabotage: boolean;
};

export type GameSceneCallbacks = {
  onStateUpdate: (state: GamePresentationState) => void;
};

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'training';
  private engine!: GameEngine;
  private battleSession: BattleSession | null = null;
  private playerTwoBot: DeterministicBot | null = null;
  private lastSabotageRouted: string | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private accumulator = 0;
  private lastState: GamePresentationState | null = null;
  private callbacks!: GameSceneCallbacks;
  private consumedThisFrame: ConsumedFlags = {
    horizontal: false,
    clockwise: false,
    counterclockwise: false,
    hardDrop: false,
    hold: false,
    triggerSabotage: false,
  };

  private cursors!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
    r: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
    c: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
  };

  /** true mientras la sesión web está pausada. El motor no recibe step() durante la pausa. */
  private isPaused = false;

  /**
   * Guardián de liberación de teclas. Bloquea left/right/softDrop hasta que
   * se observe su keyup real, evitando que teclas mantenidas durante una
   * transición (pausa→running, reinicio) produzcan acciones fantasma.
   */
  private releaseGuard: ReleaseGuard = NO_RELEASE_GUARD;

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

  /** Telemetría acumulativa de diagnóstico exclusiva para entornos DEV. */
  private devHardDropPhaseStepCount = 0;
  private devMaxActionsInSingleStep = 0;
  private lastBotActionIndex = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { callbacks: GameSceneCallbacks; mode?: GameMode }): void {
    this.callbacks = data.callbacks;
    this.mode = data.mode ?? 'training';
  }

  create(): void {
    const kb = this.input.keyboard!;

    // Construir this.cursors antes de resetEngine() para que pueda leer el
    // estado físico de las teclas al armar el guardián de liberación.
    this.cursors = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      c: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    };

    this.resetEngine();

    this.graphics = this.add.graphics();
    this.graphics.setPosition(0, 0);

    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
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

    // Registrar keyup para teclas horizontales, de soft drop y para limpiar el guardián de liberación
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'ArrowLeft') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'left');
      } else if (event.code === 'ArrowRight') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'right');
      } else if (event.code === 'ArrowDown') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'softDrop');
      } else {
        return; // Solo registrar log si es una tecla que nos interesa
      }
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
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };

    // R tiene prioridad máxima: funciona en cualquier estado (running, paused, gameOver)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.r)) {
      this.resetGame();
      return;
    }

    const engineStatus = this.engine.getSnapshot().status;

    // gameOver prevalece sobre cualquier otro estado
    if (engineStatus === 'gameOver') {
      if (this.isPaused) this.isPaused = false;              // precedencia defensiva
      Phaser.Input.Keyboard.JustDown(this.cursors.esc);       // drenar sin efecto
      this.renderFrame();
      this.engine.drainEvents();
      this.notifyState();
      return;
    }

    // Escape solo se evalúa cuando el motor no está en gameOver
    if (Phaser.Input.Keyboard.JustDown(this.cursors.esc)) {
      this.togglePause();
      return;
    }

    // Mientras está pausado: drenar entrada, renderizar (congelado) y notificar
    if (this.isPaused) {
      this.readKeys();               // drenar entrada durante la pausa (§11.4)
      this.renderFrame();
      this.notifyState();
      return;
    }

    const fixedStepMs = prototypeConfig.fixedStepMs;
    const [stepsToExecute, newAcc] = computeSteps(this.accumulator, delta, fixedStepMs);
    this.accumulator = newAcc;

    const keys = this.readKeys();

    let demoWaitingForInput = false;
    if (isTSpinDemoActive()) {
      const snap = this.engine.getSnapshot();
      if (snap.step === 0) {
        const hasInput = keys.horizontalPressed !== null ||
          keys.justPressedUp ||
          keys.justPressedZ ||
          keys.justPressedSpace ||
          keys.justPressedC ||
          keys.justPressedA ||
          keys.leftHeld ||
          keys.rightHeld ||
          keys.softDropHeld;
        if (!hasInput) {
          demoWaitingForInput = true;
          this.accumulator = 0;
        }
      }
    }

    if (!demoWaitingForInput) {
      for (let i = 0; i < stepsToExecute; i++) {
        if (this.engine.getSnapshot().status === 'gameOver') break;

      const [input, updatedConsumed] = buildStepInput(
        i === 0 ? keys : this.emptyInput(),
        i === 0
          ? this.consumedThisFrame
          : { horizontal: true, clockwise: true, counterclockwise: true, hardDrop: true, hold: true, triggerSabotage: true },
      );

      if (i === 0) {
        this.consumedThisFrame = updatedConsumed;
      }

        if (this.battleSession) {
          const bSnap = this.battleSession.getSnapshot();
          if (bSnap.status === 'running') {
            const p2Input = this.playerTwoBot
              ? this.playerTwoBot.nextStep(this.battleSession.getEngine('playerTwo'), bSnap.status, bSnap.playerOne)
              : this.emptyStepInput();
            this.battleSession.step({
              playerOne: input,
              playerTwo: p2Input,
            });
          }
        } else if (this.engine.getSnapshot().status === 'running') {
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
    }

    this.renderFrame();
    if (this.battleSession) {
      const battleEvents = this.battleSession.drainEvents();
      for (const event of battleEvents) {
        getAudioManager().handleBattleEvent(event);
        if (event.type === 'sabotageRouted') {
          this.lastSabotageRouted = `${event.sabotage} (${event.source} -> ${event.target})`;
        }
      }
    } else {
      const frameEvents = this.engine.drainEvents();
      for (const event of frameEvents) {
        getAudioManager().handleEngineEvent(event);
        if (event.type === 'sabotageTriggered' && (isSabotageDemoActive() || isOverloadDemoActive() || isGarbageDemoActive() || isPolarityDemoActive())) {
          this.engine.receiveSabotage(event.sabotage);
        }
      }
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
    }
    this.notifyState();
  }

  resetGame(): void {
    this.resetEngine();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
    this.notifyState();
    logDebug({ source: 'lifecycle', event: 'reset – resetGame' });
  }

  /**
   * Alterna entre running y paused.
   * Es la única implementación de la operación de pausa: tanto Escape como el
   * botón Vue llaman exactamente a este método.
   */
  togglePause(): void {
    const engineStatus = this.engine.getSnapshot().status;
    if (!canTogglePause(engineStatus)) return; // 1. no-op durante gameOver

    this.isPaused = !this.isPaused;             // 2. cambiar estado de sesión

    this.pendingHorizontal = null;              // 3. limpiar entrada pendiente
    this.readKeys();                            //    drenar flancos residuales del instante de la transición

    if (this.isPaused) {
      this.accumulator = 0;                     // 4. limpiar acumulador temporal
      logDebug({ source: 'lifecycle', event: 'pause' });
    } else {
      this.releaseGuard = armReleaseGuard({      // arma el rearme por liberación
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        softDrop: this.cursors.down.isDown,
      });
      this.accumulator = 0;                     // establecer la nueva referencia temporal
      logDebug({ source: 'lifecycle', event: 'resume' });
    }

    this.renderFrame();                         // 5. renderizar inmediatamente con el nuevo estado
    this.notifyState();                         // 6. notificar el nuevo estado a Vue
  }

  private resetEngine(): void {
    if (import.meta.env.DEV) {
      this.devHardDropPhaseStepCount = 0;
      this.devMaxActionsInSingleStep = 0;
      this.lastBotActionIndex = 0;
    }

    const levelDemoTarget = getLevelDemoTarget();
    if (isBattleDemoActive()) {
      // Escenario cerrado de desarrollo: Capa de Batalla Local (2P)
      this.battleSession = createBattleDemoSession();
      this.playerTwoBot = createDeterministicBot();
      this.engine = this.battleSession.getEngine('playerOne');
      this.lastSabotageRouted = null;
    } else if (levelDemoTarget !== null) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: demo de Nivel y Gravedad
      this.engine = createLevelDemoEngine(levelDemoTarget);
    } else if (isTSpinDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: tablero preparado + pieza T
      this.engine = createTSpinDemoEngine();
    } else if (isSabotageDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: demo de Residuos
      this.engine = createSabotageDemoEngine();
    } else if (isOverloadDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: demo de Sobrecarga
      this.engine = createOverloadDemoEngine();
    } else if (isGarbageDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: demo de Residuos (Garbage Demo)
      this.engine = createGarbageDemoEngine();
    } else if (isPolarityDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      // Escenario cerrado de desarrollo: demo de Polaridad inversa
      this.engine = createPolarityDemoEngine();
    } else if (this.mode === 'battle') {
      // Modo Batalla normal de producción (2P)
      this.battleSession = createBattleSession({ seed: FIXED_SEED, config: prototypeConfig });
      this.playerTwoBot = createDeterministicBot();
      this.engine = this.battleSession.getEngine('playerOne');
      this.lastSabotageRouted = null;
    } else {
      // Modo Entrenamiento normal de producción (1P)
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createGameEngine({ seed: FIXED_SEED, config: prototypeConfig });
    }
    if (this.playerTwoBot) {
      this.playerTwoBot.reset();
    }
    this.engine.drainEvents();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
    this.pendingHorizontal = null;
    this.isPaused = false;                       // el reinicio siempre deja la sesión en running
    this.releaseGuard = armReleaseGuard({
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      softDrop: this.cursors.down.isDown,
    });
    this.readKeys();                             // drena cualquier flanco pendiente antes del reinicio
    logDebug({ source: 'lifecycle', event: 'reset – engine' });
  }

  /**
   * Lee el estado de teclas para este frame.
   *
   * El flanco horizontal se determina a partir del último evento `keydown`
   * real registrado desde el frame anterior. Si la tecla correspondiente
   * ya no está mantenida (se soltó antes de consumir), el flanco se descarta
   * para no violar la validación `pressed requiere held` del motor.
   *
   * Aplica el guardián de liberación (releaseGuard) a left, right y softDrop
   * para neutralizar teclas mantenidas durante transiciones de pausa/reinicio.
   */
  private readKeys(): KeyState {
    let horizontalPressed: 'left' | 'right' | null = null;
    let leftHeld = resolveHeld(this.releaseGuard, 'left', this.cursors.left.isDown);
    let rightHeld = resolveHeld(this.releaseGuard, 'right', this.cursors.right.isDown);

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
      justPressedC: Phaser.Input.Keyboard.JustDown(this.cursors.c),
      justPressedA: Phaser.Input.Keyboard.JustDown(this.cursors.a),
      softDropHeld: resolveHeld(this.releaseGuard, 'softDrop', this.cursors.down.isDown),
    };
  }

  /**
   * Genera un KeyState para pasos lógicos adicionales dentro del mismo frame.
   * Preserva el estado mantenido de teclas horizontales y soft drop
   * porque el motor necesita conocer el valor real de `leftHeld`/`rightHeld`
   * para continuar o limpiar la secuencia DAS/ARR. El flanco horizontal
   * se bloquea (null) para no repetir la pulsación; lo mismo para rotación
   * y hard drop, que se consumen con `consumedThisFrame`.
   *
   * Aplica el guardián de liberación a left, right y softDrop.
   */
  private emptyInput(): KeyState {
    return {
      horizontalPressed: null,
      leftHeld: resolveHeld(this.releaseGuard, 'left', this.cursors.left.isDown),
      rightHeld: resolveHeld(this.releaseGuard, 'right', this.cursors.right.isDown),
      justPressedUp: false,
      justPressedZ: false,
      justPressedSpace: false,
      justPressedC: false,
      justPressedA: false,
      softDropHeld: resolveHeld(this.releaseGuard, 'softDrop', this.cursors.down.isDown),
    };
  }

  private emptyStepInput(): import('@rautfall/game-engine').StepInput {
    return {
      leftHeld: false,
      rightHeld: false,
      leftPressed: false,
      rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    };
  }

  private renderFrame(): void {
      const snap = this.battleSession ? this.battleSession.getSnapshot().playerOne : this.engine.getSnapshot();

      this.graphics.clear();

      // Dibujar tablero fijo (filas visibles 4-23)
      for (let y = HIDDEN_ROWS; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          const cell = snap.board[y]![x];
          const canvasX = boardXToCanvas(x);
          const canvasY = boardYToCanvas(y);
          if (cell !== null) {
            this.graphics.fillStyle(PIECE_COLORS[cell as PieceType | 'garbage'], 1);
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

      // Dibujar pieza fantasma si existe pieza activa
      if (snap.activePiece) {
        const ghostColor = PIECE_COLORS[snap.activePiece.type as PieceType];
        for (const cell of snap.activePiece.landingCells) {
          if (!isRowVisible(cell.y)) continue;
          const canvasX = boardXToCanvas(cell.x);
          const canvasY = boardYToCanvas(cell.y);
          this.graphics.fillStyle(ghostColor, 0.25); // Opacidad reducida
          this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
          this.graphics.lineStyle(1, ghostColor, 0.5); // Contorno con opacidad media
          this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
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
    const snap = this.battleSession ? this.battleSession.getSnapshot().playerOne : this.engine.getSnapshot();
    let newState: GamePresentationState = {
      status: computeSessionStatus(snap.status, this.isPaused),
      step: snap.step,
      elapsedMs: snap.elapsedMs,
      nextPieces: [...snap.nextPieces],
      heldPiece: snap.heldPiece,
      score: snap.score,
      combo: snap.combo,
      backToBack: snap.backToBack,
      combatEnergy: snap.combatEnergy,
      storedSabotages: [...snap.storedSabotages],
      pendingGarbage: snap.pendingGarbage,
      activeEffects: [...snap.activeEffects],
      level: snap.level,
      baseGravityCellsPerSecond: snap.baseGravityCellsPerSecond,
      activeGravityCellsPerSecond: snap.activeGravityCellsPerSecond,
    };

    if (this.battleSession) {
      const bSnap = this.battleSession.getSnapshot();

      let botDevDiagnostic: BotDevDiagnostic | undefined = undefined;
      if (import.meta.env.DEV && this.playerTwoBot) {
        const p2Engine = this.battleSession.getEngine('playerTwo');
        const p2Snap = p2Engine.getSnapshot();
        const p2Active = p2Snap.activePiece;
        const diag = this.playerTwoBot.getDiagnostic();

        let boardCellCount = 0;
        for (let r = 0; r < 24; r++) {
          const row = p2Snap.board[r];
          if (!row) continue;
          for (let c = 0; c < 10; c++) {
            if (row[c] !== null && row[c] !== undefined) boardCellCount++;
          }
        }

        const minCellY = p2Active ? Math.min(...p2Active.cells.map((cell) => cell.y)) : null;

        if (diag.currentPhase === 'waitingBeforeHardDrop') {
          this.devHardDropPhaseStepCount++;
        }

        const actionsInStep = diag.actionIndex - this.lastBotActionIndex;
        if (actionsInStep > this.devMaxActionsInSingleStep) {
          this.devMaxActionsInSingleStep = actionsInStep;
        }
        this.lastBotActionIndex = diag.actionIndex;

        botDevDiagnostic = Object.freeze({
          pieceId: p2Active?.pieceId ?? null,
          x: p2Active?.x ?? null,
          y: p2Active?.y ?? null,
          minCellY,
          orientation: p2Active?.orientation ?? null,
          boardCellCount,
          phase: diag.currentPhase,
          reactionStepsRemaining: diag.reactionTimerSteps,
          actionIntervalStepsRemaining: diag.actionIntervalTimer,
          hardDropDelayStepsRemaining: diag.hardDropDelayTimer,
          actionIndex: diag.actionIndex,
          lastActionStep: diag.lastActionStep,
          lastAction: diag.lastAction,
          currentAction: diag.currentPhase === 'executing' ? 'active' : null,
          planLength: diag.planDiagnostic?.selectedActionCount ?? 0,
          sabotageDecision: diag.sabotageDecision ? (diag.sabotageDecision.shouldTrigger ? diag.sabotageDecision.sabotage : 'none') : null,
          sabotageDecisionReason: diag.sabotageDecision?.reason ?? null,
          sabotageCooldownRemaining: diag.sabotageCooldownRemaining ?? 0,
          sabotageDecisionIntervalRemaining: diag.sabotageDecisionIntervalRemaining ?? 0,
          lastSabotageUsed: diag.lastSabotageUsed ?? null,
          lastSabotageEvaluationStep: diag.lastSabotageEvaluationStep ?? null,
          frontStoredSabotage: diag.frontStoredSabotage ?? null,
          hardDropPhaseStepCount: this.devHardDropPhaseStepCount,
          maxActionsInSingleStep: this.devMaxActionsInSingleStep,
        });
      }

      newState = {
        ...newState,
        battleState: {
          status: bSnap.status,
          winner: bSnap.winner,
          step: bSnap.step,
          lastSabotageRouted: this.lastSabotageRouted,
          playerTwo: mapEngineToOpponentPresentation(bSnap.playerTwo),
          botDevDiagnostic,
        },
      };
    }

    if (
      this.lastState &&
      this.lastState.status === newState.status &&
      this.lastState.step === newState.step &&
      this.lastState.elapsedMs === newState.elapsedMs &&
      this.lastState.nextPieces.length === newState.nextPieces.length &&
      this.lastState.nextPieces.every((p, i) => p === newState.nextPieces[i]) &&
      this.lastState.heldPiece === newState.heldPiece &&
      this.lastState.score === newState.score &&
      this.lastState.combo === newState.combo &&
      this.lastState.backToBack === newState.backToBack &&
      this.lastState.combatEnergy === newState.combatEnergy &&
      this.lastState.storedSabotages.length === newState.storedSabotages.length &&
      this.lastState.storedSabotages.every((s, i) => s === newState.storedSabotages[i]) &&
      this.lastState.pendingGarbage === newState.pendingGarbage &&
      this.lastState.activeEffects.length === newState.activeEffects.length &&
      this.lastState.activeEffects.every((e, i) => {
        const n = newState.activeEffects[i];
        if (!n || e.type !== n.type) return false;
        if (e.type === 'sobrecarga' && n.type === 'sobrecarga') return e.remainingMs === n.remainingMs;
        if (e.type === 'polaridad' && n.type === 'polaridad') return e.remainingPieces === n.remainingPieces;
        return false;
      }) &&
      this.lastState.level === newState.level &&
      this.lastState.baseGravityCellsPerSecond === newState.baseGravityCellsPerSecond &&
      this.lastState.activeGravityCellsPerSecond === newState.activeGravityCellsPerSecond &&
      (!this.lastState.battleState && !newState.battleState ||
        this.lastState.battleState && newState.battleState &&
        this.lastState.battleState.status === newState.battleState.status &&
        this.lastState.battleState.winner === newState.battleState.winner &&
        this.lastState.battleState.step === newState.battleState.step &&
        this.lastState.battleState.lastSabotageRouted === newState.battleState.lastSabotageRouted &&
        this.lastState.battleState.playerTwo === newState.battleState.playerTwo)
    ) {
      return;
    }

    this.lastState = newState;
    this.callbacks.onStateUpdate(newState);
  }
}
