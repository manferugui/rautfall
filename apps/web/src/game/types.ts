import type { PieceType } from '@rautfall/game-engine';
import type { SessionStatus } from './session-status';

/**
 * Resumen mínimo que Phaser comunica a Vue.
 */
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;
  score: number;
  combo: number;
  backToBack: number;
}>;

/**
 * Controlador que Vue puede invocar para interactuar con Phaser.
 */
export type PhaserGameController = Readonly<{
  reset(): void;
  togglePause(): void;
  destroy(): void;
}>;
