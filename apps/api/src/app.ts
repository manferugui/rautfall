import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { getAppEnv, type ApiEnv } from './config/env.js';
import { createDatabaseConnection, type AppDatabase } from './db/index.js';
import { createMatchesRepository, type MatchesRepository } from './repositories/matches-repository.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMatchesRoutes } from './routes/matches.js';
import { registerRankingRoutes } from './routes/ranking.js';
import { handleAppError } from './errors/app-error.js';

export interface AppOptions {
  env?: ApiEnv;
  db?: AppDatabase;
  matchesRepository?: MatchesRepository;
}

export function buildApp(options: AppOptions = {}): {
  fastify: FastifyInstance;
  env: ApiEnv;
  db: AppDatabase;
  matchesRepository: MatchesRepository;
  close: () => Promise<void>;
} {
  const env = options.env || getAppEnv();

  let db = options.db;
  let poolToClose: { end: () => Promise<void> } | undefined = undefined;

  if (!db) {
    const conn = createDatabaseConnection(env.DATABASE_URL);
    db = conn.db;
    poolToClose = conn.pool;
  }

  const matchesRepository = options.matchesRepository || createMatchesRepository(db);

  const fastify = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Configuración explícita de CORS según env (soporta orígenes separados por coma)
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  void fastify.register(fastifyCors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Error Handler global
  fastify.setErrorHandler(handleAppError);

  // Registro de rutas
  registerHealthRoutes(fastify, db);
  registerMatchesRoutes(fastify, matchesRepository);
  registerRankingRoutes(fastify, matchesRepository);

  async function close(): Promise<void> {
    await fastify.close();
    if (poolToClose) {
      await poolToClose.end();
    }
  }

  return {
    fastify,
    env,
    db,
    matchesRepository,
    close,
  };
}
