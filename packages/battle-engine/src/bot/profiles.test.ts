import { describe, expect, it } from 'vitest';
import {
  BOT_PROFILES,
  DEFAULT_BOT_PROFILE_ID,
  getBotProfileConfig,
  normalizeBotProfileId,
} from './profiles';

describe('Perfiles de dificultad del bot', () => {
  it('existen exactamente los tres perfiles esperados y battleOperator es el valor por defecto', () => {
    expect(Object.keys(BOT_PROFILES).sort()).toEqual([
      'battleCadet',
      'battleElite',
      'battleOperator',
    ]);
    expect(DEFAULT_BOT_PROFILE_ID).toBe('battleOperator');
  });

  it('normalizeBotProfileId resuelve correctamente alias legacy y valores no reconocidos', () => {
    expect(normalizeBotProfileId(undefined)).toBe('battleOperator');
    expect(normalizeBotProfileId(null)).toBe('battleOperator');
    expect(normalizeBotProfileId('bot-deterministic-v1')).toBe('battleOperator');
    expect(normalizeBotProfileId('battleCadet')).toBe('battleCadet');
    expect(normalizeBotProfileId('battleOperator')).toBe('battleOperator');
    expect(normalizeBotProfileId('battleElite')).toBe('battleElite');
    expect(normalizeBotProfileId('invalid-profile')).toBe('battleOperator');
  });

  it('getBotProfileConfig devuelve la configuración esperada para cada perfil', () => {
    expect(getBotProfileConfig('battleCadet')).toBe(BOT_PROFILES.battleCadet);
    expect(getBotProfileConfig('battleOperator')).toBe(BOT_PROFILES.battleOperator);
    expect(getBotProfileConfig('battleElite')).toBe(BOT_PROFILES.battleElite);
  });

  it('los parámetros mantienen el orden relativo de competencia efectiva entre CADET, OPERATOR y ELITE', () => {
    const cadet = BOT_PROFILES.battleCadet;
    const operator = BOT_PROFILES.battleOperator;
    const elite = BOT_PROFILES.battleElite;

    // Retardos y cadencia de ejecución (CADET > OPERATOR > ELITE)
    expect(cadet.reactionDelaySteps).toBeGreaterThan(operator.reactionDelaySteps);
    expect(operator.reactionDelaySteps).toBeGreaterThan(elite.reactionDelaySteps);

    expect(cadet.actionIntervalSteps).toBeGreaterThan(operator.actionIntervalSteps);
    expect(operator.actionIntervalSteps).toBeGreaterThan(elite.actionIntervalSteps);

    expect(cadet.hardDropDelaySteps).toBeGreaterThan(operator.hardDropDelaySteps);
    expect(operator.hardDropDelaySteps).toBeGreaterThan(elite.hardDropDelaySteps);

    // Selección subóptima y tolerancia (CADET > OPERATOR > ELITE)
    expect(cadet.optimalityTolerance).toBeGreaterThan(operator.optimalityTolerance);
    expect(operator.optimalityTolerance).toBeGreaterThan(elite.optimalityTolerance);

    expect(cadet.suboptimalChoiceProbability).toBeGreaterThan(operator.suboptimalChoiceProbability);
    expect(operator.suboptimalChoiceProbability).toBeGreaterThan(elite.suboptimalChoiceProbability);

    // Parámetros de cadencia y agresividad de sabotaje
    expect(cadet.sabotage.cooldownSteps).toBeGreaterThan(operator.sabotage.cooldownSteps);
    expect(operator.sabotage.cooldownSteps).toBeGreaterThan(elite.sabotage.cooldownSteps);

    expect(cadet.sabotage.decisionIntervalSteps).toBeGreaterThan(operator.sabotage.decisionIntervalSteps);
    expect(operator.sabotage.decisionIntervalSteps).toBeGreaterThan(elite.sabotage.decisionIntervalSteps);

    expect(cadet.sabotage.minimumOpponentHeightForGarbage).toBeGreaterThan(operator.sabotage.minimumOpponentHeightForGarbage);
    expect(operator.sabotage.minimumOpponentHeightForGarbage).toBeGreaterThan(elite.sabotage.minimumOpponentHeightForGarbage);

    expect(cadet.sabotage.minimumOpponentHeightForOverload).toBeGreaterThan(operator.sabotage.minimumOpponentHeightForOverload);
    expect(operator.sabotage.minimumOpponentHeightForOverload).toBeGreaterThan(elite.sabotage.minimumOpponentHeightForOverload);
  });

  it('independencia de reglas físicas: maxSearchNodes y pesos heurísticos permanecen idénticos entre perfiles', () => {
    const cadet = BOT_PROFILES.battleCadet;
    const operator = BOT_PROFILES.battleOperator;
    const elite = BOT_PROFILES.battleElite;

    expect(cadet.maxSearchNodes).toBe(500);
    expect(operator.maxSearchNodes).toBe(500);
    expect(elite.maxSearchNodes).toBe(500);

    expect(cadet.heuristicWeights).toEqual(operator.heuristicWeights);
    expect(operator.heuristicWeights).toEqual(elite.heuristicWeights);
  });
});
