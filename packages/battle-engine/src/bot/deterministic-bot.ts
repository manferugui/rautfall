import {
  Orientation,
  type EngineSnapshot,
  type GameEngine,
  type SabotageType,
  type StepInput,
} from '@rautfall/game-engine';
import type { BattleStatus } from '../index';
import {
  computeBoardFingerprint,
  searchPlacements,
} from './placement-search';
import {
  evaluateSabotageDecision,
  normalizeBotSabotageConfig,
} from './sabotage-policy';
import {
  type BotAction,
  type BotConfig,
  type BotExecutionPhase,
  type BotPlan,
  type BotPlanDiagnostic,
  type PlacementCandidate,
  type SabotageDecision,
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

export function isNeutralPlacementInput(input: StepInput): boolean {
  return (
    !input.leftHeld &&
    !input.rightHeld &&
    !input.leftPressed &&
    !input.rightPressed &&
    !input.softDropHeld &&
    !input.hardDrop &&
    !input.rotateClockwise &&
    !input.rotateCounterclockwise &&
    !input.hold
  );
}

export function isActivePieceFullyVisible(engine: GameEngine): boolean {
  const active = engine.getSnapshot().activePiece;
  if (!active) return false;
  return active.cells.every((cell) => cell.y >= 4);
}

import { BOT_PROFILES } from './profiles';
import {
  type SearchResult,
} from './placement-search';

function createDefaultPrng(seed = 12345): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectCandidate(
  searchResult: SearchResult,
  config: BotConfig,
  prng: () => number,
): PlacementCandidate | null {
  const { bestCandidate, nonTerminalCandidates, allCandidates } = searchResult;
  if (!bestCandidate) return null;

  // Regla de supervivencia: operar únicamente sobre candidatos no terminales si existe al menos uno
  const validCandidates = nonTerminalCandidates.length > 0 ? nonTerminalCandidates : allCandidates;
  if (validCandidates.length <= 1 || config.optimalityTolerance <= 0 || config.suboptimalChoiceProbability <= 0) {
    return bestCandidate;
  }

  const bestScore = bestCandidate.heuristicScore;
  const eligibleSuboptimalCandidates = validCandidates.filter(
    (c) => c !== bestCandidate && bestScore - c.heuristicScore <= config.optimalityTolerance,
  );

  if (eligibleSuboptimalCandidates.length > 0 && prng() < config.suboptimalChoiceProbability) {
    const index = Math.floor(prng() * eligibleSuboptimalCandidates.length);
    return eligibleSuboptimalCandidates[index]!;
  }

  return bestCandidate;
}

export function normalizeBotConfig(config?: Partial<BotConfig>): BotConfig {
  const defaultConfig = BOT_PROFILES.battleOperator;
  const reactionDelaySteps = Math.max(
    0,
    Math.floor(config?.reactionDelaySteps ?? defaultConfig.reactionDelaySteps),
  );
  const actionIntervalSteps = Math.max(
    0,
    Math.floor(config?.actionIntervalSteps ?? defaultConfig.actionIntervalSteps),
  );
  const hardDropDelaySteps = Math.max(
    0,
    Math.floor(config?.hardDropDelaySteps ?? defaultConfig.hardDropDelaySteps),
  );
  const maxSearchNodes = Math.max(1, Math.floor(config?.maxSearchNodes ?? defaultConfig.maxSearchNodes));
  const optimalityTolerance = Math.max(
    0,
    config?.optimalityTolerance ?? defaultConfig.optimalityTolerance,
  );
  const suboptimalChoiceProbability = Math.min(
    1,
    Math.max(0, config?.suboptimalChoiceProbability ?? defaultConfig.suboptimalChoiceProbability),
  );
  const heuristicWeights = config?.heuristicWeights ?? defaultConfig.heuristicWeights;
  const sabotage = normalizeBotSabotageConfig(config?.sabotage);

  return Object.freeze({
    reactionDelaySteps,
    actionIntervalSteps,
    hardDropDelaySteps,
    maxSearchNodes,
    optimalityTolerance,
    suboptimalChoiceProbability,
    heuristicWeights,
    sabotage,
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
  sabotageDecision?: SabotageDecision | undefined;
  sabotageCooldownRemaining?: number;
  sabotageDecisionIntervalRemaining?: number;
  lastSabotageUsed?: SabotageType | null;
  lastSabotageEvaluationStep?: number | null;
  frontStoredSabotage?: SabotageType | null;
}

export interface DeterministicBot {
  nextStep(
    engine: GameEngine,
    battleStatus?: BattleStatus,
    opponentSnapshot?: EngineSnapshot | null,
  ): StepInput;
  reset(): void;
  getDiagnostic(): DeterministicBotDiagnostic;
}

export function createDeterministicBot(
  config?: Partial<BotConfig>,
  prng?: () => number,
): DeterministicBot {
  const fullConfig = normalizeBotConfig(config);
  const botPrng = prng ?? createDefaultPrng();

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

  // Estado táctico determinista de sabotaje
  let sabotageDecisionIntervalRemaining = 0;
  let sabotageCooldownRemaining = 0;
  let lastSabotageDecision: SabotageDecision | undefined = undefined;
  let lastSabotageUsed: SabotageType | null = null;
  let lastSabotageEvaluationStep: number | null = null;
  let lastFrontStoredSabotage: SabotageType | null = null;

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

    sabotageDecisionIntervalRemaining = 0;
    sabotageCooldownRemaining = 0;
    lastSabotageDecision = undefined;
    lastSabotageUsed = null;
    lastSabotageEvaluationStep = null;
    lastFrontStoredSabotage = null;
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
    const chosenCandidate = selectCandidate(searchRes, fullConfig, botPrng);

    if (chosenCandidate) {
      currentPlan = Object.freeze({
        pieceType: snap.activePiece.type,
        actions: chosenCandidate.actions,
        expectedBoardFingerprint: chosenCandidate.boardFingerprint,
        diagnostic: Object.freeze({
          candidateCount: searchRes.searchMetrics.candidatesFound,
          nonTerminalCandidateCount: searchRes.searchMetrics.nonTerminalCandidateCount,
          exploredNodes: searchRes.searchMetrics.nodesExplored,
          deduplicatedNodes: searchRes.searchMetrics.nodesDeduplicated,
          reachedNodeLimit: searchRes.searchMetrics.reachedNodeLimit,
          selectedHeuristicScore: chosenCandidate.heuristicScore,
          selectedLinesCleared: chosenCandidate.linesCleared,
          selectedHoles: chosenCandidate.resultingHoles,
          selectedNewHoles: chosenCandidate.newHoles,
          selectedMaxHeight: chosenCandidate.maxHeight,
          selectedTopOutRisk: chosenCandidate.topOutRisk,
          selectedHiddenRowOccupancy: chosenCandidate.hiddenRowOccupancy,
          selectedActionCount: chosenCandidate.actions.length,
        }),
      });
    }
  }

  function getPlacementInput(engine: GameEngine, battleStatus?: BattleStatus): { input: StepInput; phase: BotExecutionPhase } {
    const snap = engine.getSnapshot();

    if (
      snap.status === 'gameOver' ||
      !snap.activePiece ||
      (battleStatus !== undefined && battleStatus !== 'running')
    ) {
      return { input: NEUTRAL_STEP_INPUT, phase: 'terminal' };
    }

    const active = snap.activePiece;
    const currentFingerprint = computeBoardFingerprint(snap.board);

    if (!isActivePieceFullyVisible(engine)) {
      return { input: NEUTRAL_STEP_INPUT, phase: 'waitingForVisibility' };
    }

    const currentPieceId = active.pieceId;
    const pieceChanged = trackedPieceId !== currentPieceId;
    const boardChangedUnexpectedly =
      lastBoardFingerprint !== null &&
      lastBoardFingerprint !== currentFingerprint &&
      actionIndex > 0 &&
      currentPlan?.actions[actionIndex - 1] !== 'hardDrop';

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

    if (currentPlan === null || pieceChanged || boardChangedUnexpectedly || positionMismatched) {
      trackedPieceId = currentPieceId;
      lastBoardFingerprint = currentFingerprint;
      invalidateAndPlan(engine);
    }

    lastBoardFingerprint = currentFingerprint;

    if (reactionTimerSteps > 0) {
      reactionTimerSteps--;
      expectedPosition = { x: active.x, orientation: active.orientation };
      return { input: NEUTRAL_STEP_INPUT, phase: 'reacting' };
    }

    if (!currentPlan || actionIndex >= currentPlan.actions.length) {
      invalidateAndPlan(engine);
      if (reactionTimerSteps > 0) {
        reactionTimerSteps--;
        expectedPosition = { x: active.x, orientation: active.orientation };
        return { input: NEUTRAL_STEP_INPUT, phase: 'reacting' };
      }
    }

    if (!currentPlan) {
      return { input: NEUTRAL_STEP_INPUT, phase: 'terminal' };
    }

    if (actionIntervalTimer > 0) {
      actionIntervalTimer--;
      expectedPosition = { x: active.x, orientation: active.orientation };
      return { input: NEUTRAL_STEP_INPUT, phase: 'waitingBetweenActions' };
    }

    const nextAction = currentPlan.actions[actionIndex]!;

    if (nextAction === 'hardDrop') {
      if (currentPhase !== 'waitingBeforeHardDrop') {
        hardDropDelayTimer = fullConfig.hardDropDelaySteps;
      }
      if (hardDropDelayTimer > 0) {
        hardDropDelayTimer--;
        expectedPosition = { x: active.x, orientation: active.orientation };
        return { input: NEUTRAL_STEP_INPUT, phase: 'waitingBeforeHardDrop' };
      }
    }

    actionIndex++;
    lastActionStep = snap.step;
    lastAction = nextAction;

    if (nextAction !== 'hardDrop' && nextAction !== 'wait') {
      actionIntervalTimer = fullConfig.actionIntervalSteps;
    }

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

    return { input: ACTION_STEP_INPUT_MAP[nextAction], phase: 'executing' };
  }

  return {
    nextStep(
      engine: GameEngine,
      battleStatus?: BattleStatus,
      opponentSnapshot?: EngineSnapshot | null,
    ): StepInput {
      const snap = engine.getSnapshot();
      lastFrontStoredSabotage = snap.storedSabotages[0] ?? null;

      const placementResult = getPlacementInput(engine, battleStatus);
      currentPhase = placementResult.phase;

      // Si la sesión o el motor propio están en estado terminal, no se evalúan ni activan sabotajes
      if (currentPhase === 'terminal' || snap.status === 'gameOver') {
        return placementResult.input;
      }

      // Decrementar contadores de sabotaje una vez por paso del bot
      if (sabotageCooldownRemaining > 0) {
        sabotageCooldownRemaining--;
      }
      if (sabotageDecisionIntervalRemaining > 0) {
        sabotageDecisionIntervalRemaining--;
      }

      // Evaluar la política táctica de sabotaje solo cuando:
      // 1. exista opponentSnapshot
      // 2. la entrada de colocación para este tick sea completamente neutra
      // 3. no haya cooldown activo
      // 4. no haya intervalo entre decisiones activo
      if (
        opponentSnapshot &&
        isNeutralPlacementInput(placementResult.input) &&
        sabotageCooldownRemaining === 0 &&
        sabotageDecisionIntervalRemaining === 0
      ) {
        const decision = evaluateSabotageDecision(
          {
            ownSnapshot: snap,
            opponentSnapshot,
            cooldownStepsRemaining: sabotageCooldownRemaining,
            decisionIntervalStepsRemaining: sabotageDecisionIntervalRemaining,
          },
          fullConfig.sabotage,
        );

        lastSabotageEvaluationStep = snap.step;
        lastSabotageDecision = decision;

        if (decision.shouldTrigger === true) {
          sabotageCooldownRemaining = fullConfig.sabotage.cooldownSteps;
          sabotageDecisionIntervalRemaining = fullConfig.sabotage.decisionIntervalSteps;
          lastSabotageUsed = decision.sabotage;
          return Object.freeze({
            ...placementResult.input,
            triggerSabotage: true,
          });
        } else {
          sabotageDecisionIntervalRemaining = fullConfig.sabotage.decisionIntervalSteps;
        }
      }

      return placementResult.input;
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
        sabotageDecision: lastSabotageDecision,
        sabotageCooldownRemaining,
        sabotageDecisionIntervalRemaining,
        lastSabotageUsed,
        lastSabotageEvaluationStep,
        frontStoredSabotage: lastFrontStoredSabotage,
      });
    },
  };
}
