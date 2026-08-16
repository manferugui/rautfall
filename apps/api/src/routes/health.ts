import type { FastifyInstance } from 'fastify';
import { HealthResponseSchema } from '@rautfall/contracts';
import { sql } from 'drizzle-orm';
import type { AppDatabase } from '../db/index.js';

export function registerHealthRoutes(fastify: FastifyInstance, db: AppDatabase): void {
  fastify.get(
    '/api/health',
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      let isDbConnected = false;
      try {
        await db.execute(sql`SELECT 1`);
        isDbConnected = true;
      } catch {
        // Permanece false
      }

      return reply.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: isDbConnected ? 'connected' : 'disconnected',
      });
    },
  );
}
