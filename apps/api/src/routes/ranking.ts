import type { FastifyInstance } from 'fastify';
import { Value } from '@sinclair/typebox/value';
import { GetRankingQuerySchema } from '@rautfall/contracts';
import type { MatchesRepository } from '../repositories/matches-repository.js';
import { AppError } from '../errors/app-error.js';

export function registerRankingRoutes(
  fastify: FastifyInstance,
  matchesRepository: MatchesRepository,
): void {
  // GET /api/ranking?mode=<training|battle>&limit=20
  fastify.get('/api/ranking', async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const queryObj = {
      mode: rawQuery['mode'],
      limit: rawQuery['limit'] ? Number(rawQuery['limit']) : 20,
    };

    if (!Value.Check(GetRankingQuerySchema, queryObj)) {
      throw new AppError(
        400,
        'INVALID_QUERY',
        'Parameter mode is required ("training" or "battle"). Query parameter limit must be between 1 and 100.',
      );
    }

    const ranking = await matchesRepository.getRanking(
      queryObj.mode,
      queryObj.limit ?? 20,
    );

    return reply.status(200).send(ranking);
  });
}
