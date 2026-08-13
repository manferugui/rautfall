import type { ActiveEffectSnapshot, PieceType, SabotageType } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner, BattleWarningSnapshot, BattleImmunitySnapshot, BattleParticipantStateSnapshot } from '@rautfall/battle-engine';
import type { SessionStatus } from './session-status';

export type { SessionStatus };

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
  isInterfered?: boolean;
  interferenciaRemainingMs?: number;
  warnings?: readonly BattleWarningSnapshot[];
  immunities?: readonly BattleImmunitySnapshot[];
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
  sabotageDecision?: string | null;
  sabotageDecisionReason?: string | null;
  sabotageCooldownRemaining?: number;
  sabotageDecisionIntervalRemaining?: number;
  lastSabotageUsed?: SabotageType | null;
  lastSabotageEvaluationStep?: number | null;
  frontStoredSabotage?: SabotageType | null;
  hardDropPhaseStepCount?: number;
  maxActionsInSingleStep?: number;
}>;

export type SabotageBlockedDetails = Readonly<{
  target: 'playerOne' | 'playerTwo';
  source: 'playerOne' | 'playerTwo';
  sabotage: SabotageType;
  reason: 'immunity' | 'alreadyActive' | 'warningPending';
  id: number;
}>;

export type BattlePresentationState = Readonly<{
  status: BattleStatus;
  winner: BattleWinner;
  step: number;
  lastSabotageRouted: string | null;
  lastSabotageBlocked?: string | null;
  lastSabotageBlockedDetails?: SabotageBlockedDetails | null;
  suddenDeathPhase?: string | null;
  playerOneState?: BattleParticipantStateSnapshot;
  playerTwo: OpponentPresentationState;
  botDevDiagnostic?: BotDevDiagnostic | undefined;
}>;

/**
 * Modos de juego soportados por la aplicación web.
 */
export type GameMode = 'training' | 'battle';

/**
 * Pantallas principales de la aplicación web.
 */
export type AppScreen = 'menu' | 'playing' | 'results' | 'settings' | 'history' | 'ranking' | 'devTools';


/**
 * Resumen oficial de resultados al finalizar una partida.
 */
export type GameResultSummary = Readonly<{
  mode: GameMode;
  title: string;
  subtitle?: string | undefined;
  score: number;
  linesCleared?: number;
  level: number;
  elapsedMs: number;
  battleResult?: Readonly<{
    status: BattleStatus;
    winner: BattleWinner;
    step: number;
  }> | undefined;
}>;

export type SabotageLaunchedDetails = Readonly<{
  source: 'playerOne' | 'playerTwo';
  target: 'playerOne' | 'playerTwo';
  sabotage: SabotageType;
  id: number;
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
  clearedLines: number;
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
  lastSabotageLaunchedDetails?: SabotageLaunchedDetails | null;
}>;

/**
 * Controlador que Vue puede invocar para interactuar con Phaser.
 */
export type PhaserGameController = Readonly<{
  reset(): void;
  togglePause(): void;
  destroy(): void;
  getMatchSeed?: () => number;
}>;
