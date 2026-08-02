import type { ActiveEffectSnapshot, PieceType, SabotageType } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner } from '@rautfall/battle-engine';
import type { SessionStatus } from './session-status';

export type CellPresentation = Readonly<{
  x: number;
  y: number;
  type: PieceType | 'garbage';
  appearance: 'fixed' | 'active' | 'ghost';
  color: string;
}>;

export type OpponentPresentationState = Readonly<{
  status: 'running' | 'gameOver';
  level: number;
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  activeEffects: readonly ActiveEffectSnapshot[];
  pendingGarbage: number;
  visibleCells: readonly CellPresentation[];
}>;

export type BotDevDiagnostic = Readonly<{
  pieceId: number | null;
  x: number | null;
  y: number | null;
  minCellY: number | null;
  orientation: number | null;
  boardCellCount: number;
  phase: string;
  reactionStepsRemaining: number;
  actionIntervalStepsRemaining: number;
  hardDropDelayStepsRemaining: number;
  actionIndex: number;
  lastActionStep: number | null;
  lastAction: string | null;
  currentAction: string | null;
  planLength: number;
}>;

export type BattlePresentationState = Readonly<{
  status: BattleStatus;
  winner: BattleWinner;
  step: number;
  lastSabotageRouted: string | null;
  playerTwo: OpponentPresentationState;
  botDevDiagnostic?: BotDevDiagnostic | undefined;
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
