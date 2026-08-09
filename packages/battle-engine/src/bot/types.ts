import type { EngineSnapshot, Orientation, PieceType, SabotageType } from '@rautfall/game-engine';

export type BotAction =
  | 'left'
  | 'right'
  | 'rotateClockwise'
  | 'rotateCounterClockwise'
  | 'softDrop'
  | 'hardDrop'
  | 'wait';

export type BotExecutionPhase =
  | 'waitingForVisibility'
  | 'reacting'
  | 'executing'
  | 'waitingBetweenActions'
  | 'waitingBeforeHardDrop'
  | 'terminal';

export type BotHeuristicWeights = Readonly<{
  linesClearedWeight: number;
  aggregateHeightWeight: number;
  maxHeightWeight: number;
  holesWeight: number;
  newHolesWeight: number;
  bumpinessWeight: number;
  wellsWeight: number;
  topOutRiskWeight: number;
  hiddenRowOccupancyWeight: number;
  gameOverWeight: number;
}>;

export type SabotageDecisionReason =
  | 'noStoredSabotage'
  | 'ownTerminal'
  | 'opponentTerminal'
  | 'cooldownActive'
  | 'decisionIntervalActive'
  | 'opponentTooLow'
  | 'equivalentPressureAlreadyActive'
  | 'noActiveOpponentPiece'
  | 'opponentPieceNotVisible'
  | 'poorTacticalWindow'
  | 'triggerGarbage'
  | 'triggerOverload'
  | 'triggerPolarity'
  | 'triggerInterferencia';

export type SabotageDecision =
  | Readonly<{
      shouldTrigger: false;
      sabotage: null;
      reason: SabotageDecisionReason;
    }>
  | Readonly<{
      shouldTrigger: true;
      sabotage: SabotageType;
      reason: SabotageDecisionReason;
    }>;

export type SabotagePolicyInput = Readonly<{
  ownSnapshot: EngineSnapshot;
  opponentSnapshot: EngineSnapshot;
  cooldownStepsRemaining: number;
  decisionIntervalStepsRemaining: number;
}>;

export type BotSabotageConfig = Readonly<{
  decisionIntervalSteps: number;
  cooldownSteps: number;
  minimumOpponentHeightForGarbage: number;
  minimumOpponentHeightForOverload: number;
  polarityWallDistanceThreshold: number;
  garbageTopOutRiskThreshold: number;
  polarityTopOutRiskThreshold: number;
  maximumEquivalentPendingGarbage: number;
}>;

export const DEFAULT_BOT_SABOTAGE_CONFIG: BotSabotageConfig = Object.freeze({
  decisionIntervalSteps: 20,
  cooldownSteps: 100,
  minimumOpponentHeightForGarbage: 8,
  minimumOpponentHeightForOverload: 5,
  polarityWallDistanceThreshold: 1,
  garbageTopOutRiskThreshold: 1,
  polarityTopOutRiskThreshold: 1,
  maximumEquivalentPendingGarbage: 2,
});

export type BotConfig = Readonly<{
  reactionDelaySteps: number;
  actionIntervalSteps: number;
  hardDropDelaySteps: number;
  maxSearchNodes: number;
  heuristicWeights: BotHeuristicWeights;
  sabotage: BotSabotageConfig;
}>;

export type PlacementCandidate = Readonly<{
  targetPlacement: Readonly<{ x: number; y: number; orientation: Orientation }>;
  actions: readonly BotAction[];
  heuristicScore: number;
  linesCleared: number;
  resultingHoles: number;
  newHoles: number;
  maxHeight: number;
  topOutRisk: number;
  hiddenRowOccupancy: number;
  isGameOver: boolean;
  gameOverReason: 'spawnBlocked' | 'garbageOverflow' | 'outOfBounds' | null;
  boardFingerprint: string;
}>;

export type BotPlanDiagnostic = Readonly<{
  candidateCount: number;
  nonTerminalCandidateCount: number;
  exploredNodes: number;
  deduplicatedNodes: number;
  reachedNodeLimit: boolean;
  selectedHeuristicScore: number;
  selectedLinesCleared: number;
  selectedHoles: number;
  selectedNewHoles: number;
  selectedMaxHeight: number;
  selectedTopOutRisk: number;
  selectedHiddenRowOccupancy: number;
  selectedActionCount: number;
}>;

export type BotPlan = Readonly<{
  pieceType: PieceType;
  actions: readonly BotAction[];
  expectedBoardFingerprint: string;
  diagnostic?: BotPlanDiagnostic;
}>;
