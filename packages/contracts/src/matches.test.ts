import { describe, expect, it } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import {
  CreateMatchInputSchema,
  GetMatchesQuerySchema,
  GetRankingQuerySchema,
} from './matches';

describe('Contratos de API (@rautfall/contracts)', () => {
  const validUuid1 = '123e4567-e89b-12d3-a456-426614174000';
  const validUuid2 = '987fc543-e89b-12d3-a456-426614174999';

  describe('CreateMatchInputSchema', () => {
    it('acepta una partida válida de Entrenamiento', () => {
      const validTraining = {
        clientMatchId: validUuid1,
        playerId: validUuid2,
        playerName: 'Jugador-A7F2',
        score: 1500,
        linesCleared: 12,
        durationMs: 45000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      };

      expect(Value.Check(CreateMatchInputSchema, validTraining)).toBe(true);
    });

    it('acepta una partida válida de Batalla', () => {
      const validBattle = {
        clientMatchId: validUuid1,
        playerId: validUuid2,
        playerName: 'Jugador-A7F2',
        score: 3200,
        linesCleared: 24,
        durationMs: 120000,
        level: 3,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      };

      expect(Value.Check(CreateMatchInputSchema, validBattle)).toBe(true);
    });

    it('rechaza una combinación inválida de modo y resultado (training + victory)', () => {
      const invalidCombination = {
        clientMatchId: validUuid1,
        playerId: validUuid2,
        playerName: 'Jugador-A7F2',
        score: 1500,
        linesCleared: 12,
        durationMs: 45000,
        level: 2,
        mode: 'training',
        result: 'victory',
        opponentProfile: null,
      };

      expect(Value.Check(CreateMatchInputSchema, invalidCombination)).toBe(false);
    });

    it('rechaza una partida de Batalla sin opponentProfile', () => {
      const invalidBattle = {
        clientMatchId: validUuid1,
        playerId: validUuid2,
        playerName: 'Jugador-A7F2',
        score: 3200,
        linesCleared: 24,
        durationMs: 120000,
        level: 3,
        mode: 'battle',
        result: 'victory',
        opponentProfile: null,
      };

      expect(Value.Check(CreateMatchInputSchema, invalidBattle)).toBe(false);
    });
  });

  describe('GetMatchesQuerySchema', () => {
    it('requiere playerId obligatorio como UUID', () => {
      expect(Value.Check(GetMatchesQuerySchema, { playerId: validUuid1 })).toBe(true);
      expect(Value.Check(GetMatchesQuerySchema, { playerId: 'invalid-id' })).toBe(false);
      expect(Value.Check(GetMatchesQuerySchema, {})).toBe(false);
    });
  });

  describe('GetRankingQuerySchema', () => {
    it('requiere mode obligatorio (training o battle)', () => {
      expect(Value.Check(GetRankingQuerySchema, { mode: 'training' })).toBe(true);
      expect(Value.Check(GetRankingQuerySchema, { mode: 'battle' })).toBe(true);
      expect(Value.Check(GetRankingQuerySchema, { mode: 'all' })).toBe(false);
      expect(Value.Check(GetRankingQuerySchema, {})).toBe(false);
    });
  });
});
