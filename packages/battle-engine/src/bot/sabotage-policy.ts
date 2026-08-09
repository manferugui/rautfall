import type { ActiveEffectSnapshot, ActivePieceSnapshot, EngineSnapshot, SabotageType } from '@rautfall/game-engine';
import { computeColumnHeights, computeHiddenRowOccupancy, computeTopOutRisk } from './board-evaluator';
import {
  DEFAULT_BOT_SABOTAGE_CONFIG,
  type BotSabotageConfig,
  type SabotageDecision,
  type SabotagePolicyInput,
} from './types';

export function normalizeBotSabotageConfig(config?: Partial<BotSabotageConfig>): BotSabotageConfig {
  const decisionIntervalSteps = config?.decisionIntervalSteps ?? DEFAULT_BOT_SABOTAGE_CONFIG.decisionIntervalSteps;
  const cooldownSteps = config?.cooldownSteps ?? DEFAULT_BOT_SABOTAGE_CONFIG.cooldownSteps;
  const minimumOpponentHeightForGarbage = config?.minimumOpponentHeightForGarbage ?? DEFAULT_BOT_SABOTAGE_CONFIG.minimumOpponentHeightForGarbage;
  const minimumOpponentHeightForOverload = config?.minimumOpponentHeightForOverload ?? DEFAULT_BOT_SABOTAGE_CONFIG.minimumOpponentHeightForOverload;
  const polarityWallDistanceThreshold = config?.polarityWallDistanceThreshold ?? DEFAULT_BOT_SABOTAGE_CONFIG.polarityWallDistanceThreshold;
  const garbageTopOutRiskThreshold = config?.garbageTopOutRiskThreshold ?? DEFAULT_BOT_SABOTAGE_CONFIG.garbageTopOutRiskThreshold;
  const polarityTopOutRiskThreshold = config?.polarityTopOutRiskThreshold ?? DEFAULT_BOT_SABOTAGE_CONFIG.polarityTopOutRiskThreshold;
  const maximumEquivalentPendingGarbage = config?.maximumEquivalentPendingGarbage ?? DEFAULT_BOT_SABOTAGE_CONFIG.maximumEquivalentPendingGarbage;

  const values = [
    decisionIntervalSteps,
    cooldownSteps,
    minimumOpponentHeightForGarbage,
    minimumOpponentHeightForOverload,
    polarityWallDistanceThreshold,
    garbageTopOutRiskThreshold,
    polarityTopOutRiskThreshold,
    maximumEquivalentPendingGarbage,
  ];

  for (const v of values) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || Number.isNaN(v)) {
      throw new Error(`Invalid sabotage config value: ${v}. All config parameters must be non-negative integers.`);
    }
  }

  return Object.freeze({
    decisionIntervalSteps,
    cooldownSteps,
    minimumOpponentHeightForGarbage,
    minimumOpponentHeightForOverload,
    polarityWallDistanceThreshold,
    garbageTopOutRiskThreshold,
    polarityTopOutRiskThreshold,
    maximumEquivalentPendingGarbage,
  });
}

export function getOpponentMaxHeight(board: EngineSnapshot['board']): number {
  const heights = computeColumnHeights(board);
  return Math.max(...heights);
}

export function isOpponentPieceFullyVisible(activePiece: ActivePieceSnapshot | null): boolean {
  if (!activePiece) return false;
  return activePiece.cells.every((cell) => cell.y >= 4);
}

export function getOpponentPieceWallDistance(activePiece: ActivePieceSnapshot): number {
  let minX = 9;
  let maxX = 0;
  for (const cell of activePiece.cells) {
    if (cell.x < minX) minX = cell.x;
    if (cell.x > maxX) maxX = cell.x;
  }
  const distLeft = minX;
  const distRight = 9 - maxX;
  return Math.min(distLeft, distRight);
}

export function isEffectActive(
  activeEffects: readonly ActiveEffectSnapshot[],
  effectType: 'sobrecarga' | 'polaridad',
): boolean {
  return activeEffects.some((e) => e.type === effectType);
}

export function evaluateSabotageDecision(
  input: SabotagePolicyInput,
  config: BotSabotageConfig = DEFAULT_BOT_SABOTAGE_CONFIG,
): SabotageDecision {
  const normConfig = normalizeBotSabotageConfig(config);

  if (input.ownSnapshot.status === 'gameOver' || !input.ownSnapshot.activePiece) {
    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'ownTerminal' });
  }

  if (input.opponentSnapshot.status === 'gameOver') {
    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'opponentTerminal' });
  }

  if (input.cooldownStepsRemaining > 0) {
    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'cooldownActive' });
  }

  if (input.decisionIntervalStepsRemaining > 0) {
    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'decisionIntervalActive' });
  }

  if (input.ownSnapshot.storedSabotages.length === 0) {
    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'noStoredSabotage' });
  }

  const frontSabotage: SabotageType = input.ownSnapshot.storedSabotages[0]!;

  if (frontSabotage === 'residuos') {
    const maxHeight = getOpponentMaxHeight(input.opponentSnapshot.board);
    const hiddenOccupancy = computeHiddenRowOccupancy(input.opponentSnapshot.board);
    const topOutRisk = computeTopOutRisk(maxHeight);

    if (maxHeight < normConfig.minimumOpponentHeightForGarbage) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'opponentTooLow' });
    }

    if (input.opponentSnapshot.pendingGarbage >= normConfig.maximumEquivalentPendingGarbage) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    }

    if (
      hiddenOccupancy > 0 ||
      topOutRisk >= normConfig.garbageTopOutRiskThreshold ||
      input.opponentSnapshot.pendingGarbage < normConfig.maximumEquivalentPendingGarbage
    ) {
      return Object.freeze({ shouldTrigger: true, sabotage: 'residuos', reason: 'triggerGarbage' });
    }

    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'poorTacticalWindow' });
  }

  if (frontSabotage === 'sobrecarga') {
    if (!input.opponentSnapshot.activePiece) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'noActiveOpponentPiece' });
    }

    if (isEffectActive(input.opponentSnapshot.activeEffects, 'sobrecarga')) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    }

    const maxHeight = getOpponentMaxHeight(input.opponentSnapshot.board);
    if (maxHeight < normConfig.minimumOpponentHeightForOverload) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'opponentTooLow' });
    }

    return Object.freeze({ shouldTrigger: true, sabotage: 'sobrecarga', reason: 'triggerOverload' });
  }

  if (frontSabotage === 'polaridad') {
    if (!input.opponentSnapshot.activePiece) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'noActiveOpponentPiece' });
    }

    if (!isOpponentPieceFullyVisible(input.opponentSnapshot.activePiece)) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'opponentPieceNotVisible' });
    }

    if (isEffectActive(input.opponentSnapshot.activeEffects, 'polaridad')) {
      return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    }

    const maxHeight = getOpponentMaxHeight(input.opponentSnapshot.board);
    const wallDist = getOpponentPieceWallDistance(input.opponentSnapshot.activePiece);
    const nearWall = wallDist <= normConfig.polarityWallDistanceThreshold;
    const highRisk = computeTopOutRisk(maxHeight) >= normConfig.polarityTopOutRiskThreshold;

    if (nearWall || highRisk) {
      return Object.freeze({ shouldTrigger: true, sabotage: 'polaridad', reason: 'triggerPolarity' });
    }

    return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'poorTacticalWindow' });
  }

  if (frontSabotage === 'interferencia') {
    return Object.freeze({ shouldTrigger: true, sabotage: 'interferencia', reason: 'triggerInterferencia' });
  }

  return Object.freeze({ shouldTrigger: false, sabotage: null, reason: 'poorTacticalWindow' });
}
