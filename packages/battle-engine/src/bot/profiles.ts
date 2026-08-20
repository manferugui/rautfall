import { DEFAULT_BOT_HEURISTIC_WEIGHTS } from './board-evaluator.js';
import type { BotConfig, BotProfileId } from './types.js';

export const DEFAULT_BOT_PROFILE_ID: BotProfileId = 'battleOperator';

export const BOT_PROFILES: Record<BotProfileId, BotConfig> = Object.freeze({
  battleCadet: Object.freeze({
    reactionDelaySteps: 35,
    actionIntervalSteps: 6,
    hardDropDelaySteps: 8,
    maxSearchNodes: 500,
    optimalityTolerance: 80.0,
    suboptimalChoiceProbability: 0.35,
    heuristicWeights: DEFAULT_BOT_HEURISTIC_WEIGHTS,
    sabotage: Object.freeze({
      decisionIntervalSteps: 30,
      cooldownSteps: 150,
      minimumOpponentHeightForGarbage: 10,
      minimumOpponentHeightForOverload: 7,
      polarityWallDistanceThreshold: 1,
      garbageTopOutRiskThreshold: 1,
      polarityTopOutRiskThreshold: 1,
      maximumEquivalentPendingGarbage: 2,
    }),
  }),

  battleOperator: Object.freeze({
    reactionDelaySteps: 20,
    actionIntervalSteps: 4,
    hardDropDelaySteps: 5,
    maxSearchNodes: 500,
    optimalityTolerance: 25.0,
    suboptimalChoiceProbability: 0.10,
    heuristicWeights: DEFAULT_BOT_HEURISTIC_WEIGHTS,
    sabotage: Object.freeze({
      decisionIntervalSteps: 20,
      cooldownSteps: 100,
      minimumOpponentHeightForGarbage: 8,
      minimumOpponentHeightForOverload: 5,
      polarityWallDistanceThreshold: 1,
      garbageTopOutRiskThreshold: 1,
      polarityTopOutRiskThreshold: 1,
      maximumEquivalentPendingGarbage: 2,
    }),
  }),

  battleElite: Object.freeze({
    reactionDelaySteps: 10,
    actionIntervalSteps: 2,
    hardDropDelaySteps: 3,
    maxSearchNodes: 500,
    optimalityTolerance: 5.0,
    suboptimalChoiceProbability: 0.02,
    heuristicWeights: DEFAULT_BOT_HEURISTIC_WEIGHTS,
    sabotage: Object.freeze({
      decisionIntervalSteps: 10,
      cooldownSteps: 60,
      minimumOpponentHeightForGarbage: 6,
      minimumOpponentHeightForOverload: 3,
      polarityWallDistanceThreshold: 1,
      garbageTopOutRiskThreshold: 1,
      polarityTopOutRiskThreshold: 1,
      maximumEquivalentPendingGarbage: 2,
    }),
  }),
});

/**
 * Normaliza cualquier identificador de perfil (incluyendo legacy 'bot-deterministic-v1' y undefined)
 * a un BotProfileId válido ('battleCadet' | 'battleOperator' | 'battleElite').
 */
export function normalizeBotProfileId(value: string | undefined | null): BotProfileId {
  if (value === 'battleCadet') return 'battleCadet';
  if (value === 'battleElite') return 'battleElite';
  if (value === 'battleOperator' || value === 'bot-deterministic-v1' || !value) {
    return 'battleOperator';
  }
  return DEFAULT_BOT_PROFILE_ID;
}

/**
 * Obtiene la configuración BotConfig correspondiente a un BotProfileId estricto.
 */
export function getBotProfileConfig(profileId: BotProfileId): BotConfig {
  return BOT_PROFILES[profileId];
}
