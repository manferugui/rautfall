import type { ActiveEffectSnapshot, PieceType, SabotageType } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner } from '@rautfall/battle-engine';
import type { SessionStatus } from './session-status';

export type BattlePresentationState = Readonly<{
  status: BattleStatus;
  winner: BattleWinner;
  step: number;
  playerTwoStatus: string;
  playerTwoLevel: number;
  playerTwoCombatEnergy: number;
  playerTwoStoredSabotages: readonly SabotageType[];
  playerTwoActiveEffects: readonly ActiveEffectSnapshot[];
  lastSabotageRouted: string | null;
}>;

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
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  pendingGarbage: number;
  activeEffects: readonly ActiveEffectSnapshot[];
  level: number;
  baseGravityCellsPerSecond: number;
  activeGravityCellsPerSecond: number;
  battleState?: BattlePresentationState;
}>;

/**
 * Controlador que Vue puede invocar para interactuar con Phaser.
 */
export type PhaserGameController = Readonly<{
  reset(): void;
  togglePause(): void;
  destroy(): void;
}>;
