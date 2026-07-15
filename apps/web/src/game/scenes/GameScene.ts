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
 * - No contiene reglas de dominio (colisiones, SRS, gravedad, etc.).
 */

import Phaser from 'phaser';
import { createGameEngine, type GameEngine, type PieceType } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import type { GamePresentationState } from '../types';
import { computeSteps } from '../time-adapter';
import { buildStepInput, type KeyState } from '../input-buffer';
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
    space: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
    r: Phaser.Input.Keyboard.Key;
  };

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
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
    this.lastState = null;
  }

  update(_time: number, delta: number): void {
    // Reiniciar banderas de consumo al empezar el frame. JustDown ya garantiza
    // detección única entre frames; consumedThisFrame solo evita que una misma
    // pulsación dispare varias acciones en pasos lógicos múltiples del mismo frame.
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
        this.engine.step(input);
      }
    }

    this.renderFrame();
    this.engine.drainEvents();
    this.notifyState();
  }

  resetGame(): void {
    this.resetEngine();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
    this.notifyState();
  }

  private resetEngine(): void {
    this.engine = createGameEngine({ seed: FIXED_SEED, config: prototypeConfig });
    this.engine.drainEvents();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
  }

  private readKeys(): KeyState {
    return {
      justPressedLeft: Phaser.Input.Keyboard.JustDown(this.cursors.left),
      justPressedRight: Phaser.Input.Keyboard.JustDown(this.cursors.right),
      isDownLeft: this.cursors.left.isDown,
      isDownRight: this.cursors.right.isDown,
      justPressedUp: Phaser.Input.Keyboard.JustDown(this.cursors.up),
      justPressedZ: Phaser.Input.Keyboard.JustDown(this.cursors.z),
      justPressedSpace: Phaser.Input.Keyboard.JustDown(this.cursors.space),
    };
  }

  private emptyInput(): KeyState {
    return {
      justPressedLeft: false,
      justPressedRight: false,
      isDownLeft: false,
      isDownRight: false,
      justPressedUp: false,
      justPressedZ: false,
      justPressedSpace: false,
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
    };

    if (
      this.lastState &&
      this.lastState.status === newState.status &&
      this.lastState.step === newState.step &&
      this.lastState.elapsedMs === newState.elapsedMs
    ) {
      return;
    }

    this.lastState = newState;
    this.callbacks.onStateUpdate(newState);
  }
}
