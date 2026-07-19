import type { PieceType } from '@rautfall/game-engine';

/**
 * Resumen mínimo que Phaser comunica a Vue.
 */
export type GamePresentationState = Readonly<{
  status: 'running' | 'gameOver';
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
}>;

/**
 * Controlador que Vue puede invocar para interactuar con Phaser.
 */
export type PhaserGameController = Readonly<{
  reset(): void;
  destroy(): void;
}>;
