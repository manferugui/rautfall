import type { Orientation, PieceType } from '@rautfall/game-engine';

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

export type BotConfig = Readonly<{
  reactionDelaySteps: number;
  actionIntervalSteps: number;
  hardDropDelaySteps: number;
  maxSearchNodes: number;
  heuristicWeights: BotHeuristicWeights;
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
