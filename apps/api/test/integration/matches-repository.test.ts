import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseConnection, type AppDatabase } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { createMatchesRepository, type MatchesRepository } from '../../src/repositories/matches-repository';
import { matches } from '../../src/db/schema';
import { sql } from 'drizzle-orm';

describe('MatchesRepository (Integración con PostgreSQL real via Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let db: AppDatabase;
  let pool: { end: () => Promise<void> };
  let repository: MatchesRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const conn = createDatabaseConnection(container.getConnectionUri());
    db = conn.db;
    pool = conn.pool;

    await runMigrations(db);
    repository = createMatchesRepository(db);
  }, 60000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE ${matches} RESTART IDENTITY CASCADE`);
  });

  const uuidPlayer1 = '11111111-1111-4111-8111-111111111111';
  const uuidPlayer2 = '22222222-2222-4222-8222-222222222222';
  const clientMatchId1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const clientMatchId2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const clientMatchId3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  describe('saveMatch (Idempotencia)', () => {
    it('inserta una partida de entrenamiento nueva con isNew: true', async () => {
      const result = await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1500,
        linesCleared: 10,
        durationMs: 30000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      expect(result.isNew).toBe(true);
      expect(result.match.id).toBeDefined();
      expect(result.match.clientMatchId).toBe(clientMatchId1);
      expect(result.match.score).toBe(1500);
      expect(result.match.mode).toBe('training');
    });

    it('devuelve el registro existente con isNew: false al repetir clientMatchId', async () => {
      const first = await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1500,
        linesCleared: 10,
        durationMs: 30000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      const second = await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1500,
        linesCleared: 10,
        durationMs: 30000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(false);
      expect(second.match.id).toBe(first.match.id);
    });

    it('lanza AppError 409 MATCH_IDEMPOTENCY_CONFLICT si el clientMatchId ya existe con un payload contractual diferente', async () => {
      await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1500,
        linesCleared: 10,
        durationMs: 30000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      await expect(
        repository.saveMatch({
          clientMatchId: clientMatchId1,
          playerId: uuidPlayer1,
          playerName: 'Jugador-1111',
          score: 9999, // score distinto!
          linesCleared: 10,
          durationMs: 30000,
          level: 2,
          mode: 'training',
          result: 'finished',
          opponentProfile: null,
        }),
      ).rejects.toThrow('El clientMatchId especificado ya existe pero con un payload contractual diferente.');
    });
  });

  describe('getMatchHistory', () => {
    it('devuelve las partidas del jugador ordenadas por fecha DESC', async () => {
      await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1000,
        linesCleared: 5,
        durationMs: 20000,
        level: 1,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      await repository.saveMatch({
        clientMatchId: clientMatchId2,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 2500,
        linesCleared: 18,
        durationMs: 60000,
        level: 2,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      await repository.saveMatch({
        clientMatchId: clientMatchId3,
        playerId: uuidPlayer2,
        playerName: 'Jugador-2222',
        score: 5000,
        linesCleared: 30,
        durationMs: 90000,
        level: 4,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      const history = await repository.getMatchHistory(uuidPlayer1, 10);
      expect(history).toHaveLength(2);
      expect(history[0]?.clientMatchId).toBe(clientMatchId2);
      expect(history[1]?.clientMatchId).toBe(clientMatchId1);
    });
  });

  describe('getRanking', () => {
    it('devuelve una única mejor partida por jugador con tie-break determinista', async () => {
      // Jugador 1: 2 partidas en battle (score 1000 y score 3000)
      await repository.saveMatch({
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1000,
        linesCleared: 5,
        durationMs: 20000,
        level: 1,
        mode: 'battle',
        result: 'defeat',
        opponentProfile: 'bot-deterministic-v1',
      });

      await repository.saveMatch({
        clientMatchId: clientMatchId2,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 3000,
        linesCleared: 20,
        durationMs: 50000,
        level: 3,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      // Jugador 2: 1 partida en battle (score 5000)
      await repository.saveMatch({
        clientMatchId: clientMatchId3,
        playerId: uuidPlayer2,
        playerName: 'Jugador-2222',
        score: 5000,
        linesCleared: 35,
        durationMs: 80000,
        level: 4,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      const ranking = await repository.getRanking('battle', 10);
      expect(ranking).toHaveLength(2);

      // Rank #1: Jugador 2 (5000)
      expect(ranking[0]?.rank).toBe(1);
      expect(ranking[0]?.playerId).toBe(uuidPlayer2);
      expect(ranking[0]?.score).toBe(5000);

      // Rank #2: Jugador 1 (su mejor partida de 3000, no la de 1000)
      expect(ranking[1]?.rank).toBe(2);
      expect(ranking[1]?.playerId).toBe(uuidPlayer1);
      expect(ranking[1]?.score).toBe(3000);
    });

    it('cumple exactamente el ranking A (100, 200) vs B (150, 180) y aísla modos', async () => {
      const matchA1 = 'a1111111-1111-4111-8111-111111111111';
      const matchA2 = 'a2222222-2222-4222-8222-222222222222';
      const matchB1 = 'b1111111-1111-4111-8111-111111111111';
      const matchB2 = 'b2222222-2222-4222-8222-222222222222';

      // Jugador A: 100 y 200 en battle
      await repository.saveMatch({
        clientMatchId: matchA1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-A',
        score: 100,
        linesCleared: 1,
        durationMs: 10000,
        level: 1,
        mode: 'battle',
        result: 'defeat',
        opponentProfile: 'bot-deterministic-v1',
      });
      await repository.saveMatch({
        clientMatchId: matchA2,
        playerId: uuidPlayer1,
        playerName: 'Jugador-A',
        score: 200,
        linesCleared: 2,
        durationMs: 20000,
        level: 1,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      // Jugador B: 150 y 180 en battle
      await repository.saveMatch({
        clientMatchId: matchB1,
        playerId: uuidPlayer2,
        playerName: 'Jugador-B',
        score: 150,
        linesCleared: 1,
        durationMs: 15000,
        level: 1,
        mode: 'battle',
        result: 'defeat',
        opponentProfile: 'bot-deterministic-v1',
      });
      await repository.saveMatch({
        clientMatchId: matchB2,
        playerId: uuidPlayer2,
        playerName: 'Jugador-B',
        score: 180,
        linesCleared: 2,
        durationMs: 18000,
        level: 1,
        mode: 'battle',
        result: 'victory',
        opponentProfile: 'bot-deterministic-v1',
      });

      // Partida de entrenamiento del Jugador A (9999 pts) para comprobar aislamiento
      await repository.saveMatch({
        clientMatchId: 'aaaaaaaa-9999-4999-8999-999999999999',
        playerId: uuidPlayer1,
        playerName: 'Jugador-A',
        score: 9999,
        linesCleared: 50,
        durationMs: 99000,
        level: 5,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      });

      const rankingBattle = await repository.getRanking('battle', 10);
      expect(rankingBattle).toHaveLength(2);
      expect(rankingBattle[0]?.playerName).toBe('Jugador-A');
      expect(rankingBattle[0]?.score).toBe(200);
      expect(rankingBattle[1]?.playerName).toBe('Jugador-B');
      expect(rankingBattle[1]?.score).toBe(180);

      const rankingTraining = await repository.getRanking('training', 10);
      expect(rankingTraining).toHaveLength(1);
      expect(rankingTraining[0]?.playerName).toBe('Jugador-A');
      expect(rankingTraining[0]?.score).toBe(9999);
    });
  });
});
