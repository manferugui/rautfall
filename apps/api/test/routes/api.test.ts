import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { createDatabaseConnection, type AppDatabase } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { matches } from '../../src/db/schema';
import { sql } from 'drizzle-orm';
import type { HealthResponse, MatchRecord, RankingEntry } from '@rautfall/contracts';

describe('Rutas HTTP API (Fastify Inject + PostgreSQL Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let db: AppDatabase;
  let pool: { end: () => Promise<void> };
  let fastify: FastifyInstance;
  let closeApp: () => Promise<void>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const conn = createDatabaseConnection(container.getConnectionUri());
    db = conn.db;
    pool = conn.pool;

    await runMigrations(db);

    const appObj = buildApp({
      env: {
        NODE_ENV: 'test',
        PORT: 3000,
        HOST: '127.0.0.1',
        DATABASE_URL: container.getConnectionUri(),
        CORS_ORIGIN: 'http://localhost:5173',
      },
      db,
    });

    fastify = appObj.fastify;
    closeApp = appObj.close;
    await fastify.ready();
  }, 60000);

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
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
  const clientMatchId1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  describe('GET /api/health', () => {
    it('devuelve status 200 y database: connected', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as HealthResponse;
      expect(body.status).toBe('ok');
      expect(body.database).toBe('connected');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/matches', () => {
    it('registra una partida válida de Entrenamiento (201 Created)', async () => {
      const payload = {
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1800,
        linesCleared: 15,
        durationMs: 40000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      };

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload,
      });

      expect(res.statusCode).toBe(201);
      const match = JSON.parse(res.payload) as MatchRecord;
      expect(match.id).toBeDefined();
      expect(match.clientMatchId).toBe(clientMatchId1);
      expect(match.mode).toBe('training');
      expect(match.result).toBe('finished');
    });

    it('devuelve 200 OK idempotente para un clientMatchId ya registrado', async () => {
      const payload = {
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1800,
        linesCleared: 15,
        durationMs: 40000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      };

      const res1 = await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload,
      });
      expect(res1.statusCode).toBe(201);

      const res2 = await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload,
      });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.payload)).toEqual(JSON.parse(res1.payload));
    });

    it('devuelve 409 Conflict si se repite clientMatchId con un payload contractual distinto', async () => {
      const payloadOriginal = {
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1800,
        linesCleared: 15,
        durationMs: 40000,
        level: 2,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      };

      await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload: payloadOriginal,
      });

      const payloadConflicto = {
        ...payloadOriginal,
        score: 9999, // Distinta puntuación
      };

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload: payloadConflicto,
      });

      expect(res.statusCode).toBe(409);
      const err = JSON.parse(res.payload);
      expect(err.code).toBe('MATCH_IDEMPOTENCY_CONFLICT');
    });

    it('devuelve 400 Bad Request si la combinación de modo y resultado es inválida', async () => {
      const invalidPayload = {
        clientMatchId: clientMatchId1,
        playerId: uuidPlayer1,
        playerName: 'Jugador-1111',
        score: 1800,
        linesCleared: 15,
        durationMs: 40000,
        level: 2,
        mode: 'training',
        result: 'victory', // Inválido en training
        opponentProfile: null,
      };

      const res = await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload: invalidPayload,
      });

      expect(res.statusCode).toBe(400);
      const err = JSON.parse(res.payload);
      expect(err.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('GET /api/matches (History por jugador)', () => {
    it('requiere el parámetro playerId obligatorio (400 Bad Request si no existe)', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/matches',
      });

      expect(res.statusCode).toBe(400);
    });

    it('devuelve 400 Bad Request si limit es menor a 1 o mayor a 100', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/matches?playerId=${uuidPlayer1}&limit=500`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('devuelve el historial de partidas del playerId indicado', async () => {
      await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload: {
          clientMatchId: clientMatchId1,
          playerId: uuidPlayer1,
          playerName: 'Jugador-1111',
          score: 1800,
          linesCleared: 15,
          durationMs: 40000,
          level: 2,
          mode: 'training',
          result: 'finished',
          opponentProfile: null,
        },
      });

      const res = await fastify.inject({
        method: 'GET',
        url: `/api/matches?playerId=${uuidPlayer1}&limit=10`,
      });

      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.payload) as MatchRecord[];
      expect(list).toHaveLength(1);
      expect(list[0]?.playerId).toBe(uuidPlayer1);
    });
  });

  describe('GET /api/ranking (Ranking por modo)', () => {
    it('requiere el parámetro mode obligatorio (400 Bad Request si no existe)', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/ranking',
      });

      expect(res.statusCode).toBe(400);
    });

    it('devuelve la clasificación por el modo indicado', async () => {
      await fastify.inject({
        method: 'POST',
        url: '/api/matches',
        payload: {
          clientMatchId: clientMatchId1,
          playerId: uuidPlayer1,
          playerName: 'Jugador-1111',
          score: 1800,
          linesCleared: 15,
          durationMs: 40000,
          level: 2,
          mode: 'battle',
          result: 'victory',
          opponentProfile: 'bot-deterministic-v1',
        },
      });

      const res = await fastify.inject({
        method: 'GET',
        url: '/api/ranking?mode=battle&limit=10',
      });

      expect(res.statusCode).toBe(200);
      const ranking = JSON.parse(res.payload) as RankingEntry[];
      expect(ranking).toHaveLength(1);
      expect(ranking[0]?.rank).toBe(1);
      expect(ranking[0]?.score).toBe(1800);
      expect(ranking[0]?.mode).toBe('battle');
    });
  });
});
