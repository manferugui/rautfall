import {
  Orientation,
  type GameEngine,
  type StepInput,
} from '@rautfall/game-engine';
import type { BattleStatus } from '../index';
import { DEFAULT_BOT_HEURISTIC_WEIGHTS } from './board-evaluator';
import {
  computeBoardFingerprint,
  searchPlacements,
} from './placement-search';
import {
  type BotAction,
  type BotConfig,
  type BotExecutionPhase,
  type BotPlan,
  type BotPlanDiagnostic,
} from './types';

export const BOT_REACTION_DELAY_STEPS = 20;
export const BOT_ACTION_INTERVAL_STEPS = 4;
export const BOT_HARD_DROP_DELAY_STEPS = 5;

const NEUTRAL_STEP_INPUT: StepInput = Object.freeze({
  leftHeld: false,
  rightHeld: false,
  leftPressed: false,
  rightPressed: false,
  softDropHeld: false,
  hardDrop: false,
});

const ACTION_STEP_INPUT_MAP: Record<BotAction, StepInput> = {
  left: Object.freeze({
    leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
    softDropHeld: false, hardDrop: false,
  }),
  right: Object.freeze({
    leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true,
    softDropHeld: false, hardDrop: false,
  }),
  rotateClockwise: Object.freeze({
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: false, hardDrop: false, rotateClockwise: true,
  }),
  rotateCounterClockwise: Object.freeze({
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: false, hardDrop: false, rotateCounterclockwise: true,
  }),
  softDrop: Object.freeze({
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: true, hardDrop: false,
  }),
  hardDrop: Object.freeze({
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: false, hardDrop: true,
  }),
  wait: NEUTRAL_STEP_INPUT,
};

export function isActivePieceFullyVisible(engine: GameEngine): boolean {
  const active = engine.getSnapshot().activePiece;
  if (!active) return false;
  return active.cells.every((cell) => cell.y >= 4);
}

export function normalizeBotConfig(config?: Partial<BotConfig>): BotConfig {
  const reactionDelaySteps = Math.max(
    0,
    Math.floor(config?.reactionDelaySteps ?? BOT_REACTION_DELAY_STEPS),
  );
  const actionIntervalSteps = Math.max(
    0,
    Math.floor(config?.actionIntervalSteps ?? BOT_ACTION_INTERVAL_STEPS),
  );
  const hardDropDelaySteps = Math.max(
    0,
    Math.floor(config?.hardDropDelaySteps ?? BOT_HARD_DROP_DELAY_STEPS),
  );
  const maxSearchNodes = Math.max(1, Math.floor(config?.maxSearchNodes ?? 500));
  const heuristicWeights = config?.heuristicWeights ?? DEFAULT_BOT_HEURISTIC_WEIGHTS;

  return Object.freeze({
    reactionDelaySteps,
    actionIntervalSteps,
    hardDropDelaySteps,
    maxSearchNodes,
    heuristicWeights,
  });
}

export interface DeterministicBotDiagnostic {
  currentPhase: BotExecutionPhase;
  reactionTimerSteps: number;
  actionIntervalTimer: number;
  hardDropDelayTimer: number;
  actionIndex: number;
  lastActionStep: number | null;
  lastAction: string | null;
  planDiagnostic?: BotPlanDiagnostic | undefined;
}

export interface DeterministicBot {
  nextStep(engine: GameEngine, battleStatus?: BattleStatus): StepInput;
  reset(): void;
  getDiagnostic(): DeterministicBotDiagnostic;
}

export function createDeterministicBot(config?: Partial<BotConfig>): DeterministicBot {
  const fullConfig = normalizeBotConfig(config);

  let currentPlan: BotPlan | null = null;
  let actionIndex = 0;
  let reactionTimerSteps = fullConfig.reactionDelaySteps;
  let actionIntervalTimer = 0;
  let hardDropDelayTimer = 0;
  let currentPhase: BotExecutionPhase = 'waitingForVisibility';

  let trackedPieceId: number | null = null;
  let expectedPosition: { x: number; orientation: Orientation } | null = null;
  let lastBoardFingerprint: string | null = null;
  let lastActionStep: number | null = null;
  let lastAction: string | null = null;

  function reset(): void {
    currentPlan = null;
    actionIndex = 0;
    currentPhase = 'waitingForVisibility';
    reactionTimerSteps = fullConfig.reactionDelaySteps;
    actionIntervalTimer = 0;
    hardDropDelayTimer = 0;
    trackedPieceId = null;
    expectedPosition = null;
    lastBoardFingerprint = null;
    lastActionStep = null;
    lastAction = null;
  }

  function invalidateAndPlan(engine: GameEngine): void {
    currentPlan = null;
    actionIndex = 0;
    reactionTimerSteps = fullConfig.reactionDelaySteps;
    actionIntervalTimer = 0;
    hardDropDelayTimer = 0;
    expectedPosition = null;

    const snap = engine.getSnapshot();
    if (!snap.activePiece) return;

    const searchRes = searchPlacements(engine, fullConfig);
    if (searchRes.bestCandidate) {
      currentPlan = Object.freeze({
        pieceType: snap.activePiece.type,
        actions: searchRes.bestCandidate.actions,
        expectedBoardFingerprint: searchRes.bestCandidate.boardFingerprint,
        diagnostic: Object.freeze({
          candidateCount: searchRes.searchMetrics.candidatesFound,
          nonTerminalCandidateCount: searchRes.searchMetrics.nonTerminalCandidateCount,
          exploredNodes: searchRes.searchMetrics.nodesExplored,
          deduplicatedNodes: searchRes.searchMetrics.nodesDeduplicated,
          reachedNodeLimit: searchRes.searchMetrics.reachedNodeLimit,
          selectedHeuristicScore: searchRes.bestCandidate.heuristicScore,
          selectedLinesCleared: searchRes.bestCandidate.linesCleared,
          selectedHoles: searchRes.bestCandidate.resultingHoles,
          selectedNewHoles: searchRes.bestCandidate.newHoles,
          selectedMaxHeight: searchRes.bestCandidate.maxHeight,
          selectedTopOutRisk: searchRes.bestCandidate.topOutRisk,
          selectedHiddenRowOccupancy: searchRes.bestCandidate.hiddenRowOccupancy,
          selectedActionCount: searchRes.bestCandidate.actions.length,
        }),
      });
    }
  }

  return {
    nextStep(engine: GameEngine, battleStatus?: BattleStatus): StepInput {
      const snap = engine.getSnapshot();

      // Si la partida o batalla terminaron, entrar en fase terminal
      if (
        snap.status === 'gameOver' ||
        !snap.activePiece ||
        (battleStatus !== undefined && battleStatus !== 'running')
      ) {
        currentPhase = 'terminal';
        return NEUTRAL_STEP_INPUT;
      }

      const active = snap.activePiece;
      const currentFingerprint = computeBoardFingerprint(snap.board);

      // FASE 2: La pieza DEBE estar completamente visible (todas sus celdas en y >= 4)
      if (!isActivePieceFullyVisible(engine)) {
        currentPhase = 'waitingForVisibility';
        return NEUTRAL_STEP_INPUT;
      }

      const currentPieceId = active.pieceId;
      const pieceChanged = trackedPieceId !== currentPieceId;
      const boardChangedUnexpectedly =
        lastBoardFingerprint !== null &&
        lastBoardFingerprint !== currentFingerprint &&
        actionIndex > 0 &&
        currentPlan?.actions[actionIndex - 1] !== 'hardDrop';

      // FASE 4: Validar posición esperada ignorando descensos por gravedad natural en Y
      let positionMismatched = false;
      if (expectedPosition !== null && !pieceChanged) {
        if (
          active.orientation !== expectedPosition.orientation ||
          (actionIndex > 0 &&
            (currentPlan?.actions[actionIndex - 1] === 'left' ||
              currentPlan?.actions[actionIndex - 1] === 'right') &&
            active.x !== expectedPosition.x)
        ) {
          positionMismatched = true;
        }
      }

      // Si se requiere replanificar por cambio de pieza o discrepancia de posición (Polaridad)
      if (currentPlan === null || pieceChanged || boardChangedUnexpectedly || positionMismatched) {
        trackedPieceId = currentPieceId;
        lastBoardFingerprint = currentFingerprint;
        invalidateAndPlan(engine);
      }

      lastBoardFingerprint = currentFingerprint;

      // FASE 3: Consumir retardo de reacción de 30 pasos lógicos
      if (reactionTimerSteps > 0) {
        currentPhase = 'reacting';
        reactionTimerSteps--;
        expectedPosition = { x: active.x, orientation: active.orientation };
        return NEUTRAL_STEP_INPUT;
      }

      // Si el plan expiró sin fijar la pieza, replanificar
      if (!currentPlan || actionIndex >= currentPlan.actions.length) {
        invalidateAndPlan(engine);
        if (reactionTimerSteps > 0) {
          currentPhase = 'reacting';
          reactionTimerSteps--;
          expectedPosition = { x: active.x, orientation: active.orientation };
          return NEUTRAL_STEP_INPUT;
        }
      }

      if (!currentPlan) {
        currentPhase = 'terminal';
        return NEUTRAL_STEP_INPUT;
      }

      // FASE 3: Consumir intervalo entre acciones de movimiento/rotación (6 pasos)
      if (actionIntervalTimer > 0) {
        currentPhase = 'waitingBetweenActions';
        actionIntervalTimer--;
        expectedPosition = { x: active.x, orientation: active.orientation };
        return NEUTRAL_STEP_INPUT;
      }

      const nextAction = currentPlan.actions[actionIndex]!;

      // FASE 3: Pausa de 5 pasos antes del hard drop final
      if (nextAction === 'hardDrop') {
        if (currentPhase !== 'waitingBeforeHardDrop') {
          hardDropDelayTimer = fullConfig.hardDropDelaySteps;
        }
        if (hardDropDelayTimer > 0) {
          currentPhase = 'waitingBeforeHardDrop';
          hardDropDelayTimer--;
          expectedPosition = { x: active.x, orientation: active.orientation };
          return NEUTRAL_STEP_INPUT;
        }
      }

      // Consumir la acción planificada
      currentPhase = 'executing';
      actionIndex++;
      lastActionStep = snap.step;
      lastAction = nextAction;

      // Configurar temporizador de intervalo si la acción fue un movimiento o rotación
      if (nextAction !== 'hardDrop' && nextAction !== 'wait') {
        actionIntervalTimer = fullConfig.actionIntervalSteps;
      }

      // Calcular posición horizontal y orientación esperadas
      let expX = active.x;
      let expOrient = active.orientation;
      if (nextAction === 'left') expX = active.x - 1;
      if (nextAction === 'right') expX = active.x + 1;
      if (nextAction === 'rotateClockwise') {
        expOrient = ((active.orientation + 1) % 4) as Orientation;
      }
      if (nextAction === 'rotateCounterClockwise') {
        expOrient = ((active.orientation + 3) % 4) as Orientation;
      }
      expectedPosition = { x: expX, orientation: expOrient };

      return ACTION_STEP_INPUT_MAP[nextAction];
    },

    reset,

    getDiagnostic(): DeterministicBotDiagnostic {
      return Object.freeze({
        currentPhase,
        reactionTimerSteps,
        actionIntervalTimer,
        hardDropDelayTimer,
        actionIndex,
        lastActionStep,
        lastAction,
        planDiagnostic: currentPlan?.diagnostic,
      });
    },
  };
}
