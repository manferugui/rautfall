import type { FastifyInstance } from 'fastify';
import { Value } from '@sinclair/typebox/value';
import {
  CreateMatchInputSchema,
  GetMatchesQuerySchema,
} from '@rautfall/contracts';
import type { MatchesRepository } from '../repositories/matches-repository.js';
import { AppError } from '../errors/app-error.js';

export function registerMatchesRoutes(
  fastify: FastifyInstance,
  matchesRepository: MatchesRepository,
): void {
  // POST /api/matches
  fastify.post('/api/matches', async (request, reply) => {
    if (!Value.Check(CreateMatchInputSchema, request.body)) {
      const errors = [...Value.Errors(CreateMatchInputSchema, request.body)];
      throw new AppError(
        400,
        'INVALID_PAYLOAD',
        `Payload validation failed: ${errors.map((e) => `${e.path} ${e.message}`).join(', ')}`,
      );
    }

    const input = request.body;
    const { isNew, match } = await matchesRepository.saveMatch(input);

    const statusCode = isNew ? 201 : 200;
    return reply.status(statusCode).send(match);
  });

  // GET /api/matches?playerId=<uuid>&limit=20
  fastify.get('/api/matches', async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const queryObj = {
      playerId: rawQuery['playerId'],
      limit: rawQuery['limit'] ? Number(rawQuery['limit']) : 20,
    };

    if (!Value.Check(GetMatchesQuerySchema, queryObj)) {
      throw new AppError(
        400,
        'INVALID_QUERY',
        'Parameter playerId must be a valid UUID. Query parameter limit must be between 1 and 100.',
      );
    }

    const matches = await matchesRepository.getMatchHistory(
      queryObj.playerId,
      queryObj.limit ?? 20,
    );

    return reply.status(200).send(matches);
  });
}
