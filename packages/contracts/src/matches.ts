import { Type, type Static } from '@sinclair/typebox';

export const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/**
 * Tipo helper para validar UUID v4.
 */
const UuidType = () => Type.String({ pattern: UUID_PATTERN });

/**
 * Modos de juego soportados en la API.
 */
export const GameModeSchema = Type.Union([
  Type.Literal('training'),
  Type.Literal('battle'),
]);

export type GameModeContract = Static<typeof GameModeSchema>;

/**
 * Campos comunes compartidos por todos los registros de partida.
 */
const BaseMatchFields = {
  clientMatchId: UuidType(),
  playerId: UuidType(),
  playerName: Type.String({ minLength: 1, maxLength: 30 }),
  score: Type.Integer({ minimum: 0 }),
  linesCleared: Type.Integer({ minimum: 0 }),
  durationMs: Type.Integer({ minimum: 0 }),
  level: Type.Integer({ minimum: 1 }),
};

/**
 * Entrada para registrar partida en modo Entrenamiento.
 */
export const CreateTrainingMatchInputSchema = Type.Object({
  ...BaseMatchFields,
  mode: Type.Literal('training'),
  result: Type.Literal('finished'),
  opponentProfile: Type.Null(),
});

/**
 * Entrada para registrar partida en modo Batalla.
 */
export const CreateBattleMatchInputSchema = Type.Object({
  ...BaseMatchFields,
  mode: Type.Literal('battle'),
  result: Type.Union([
    Type.Literal('victory'),
    Type.Literal('defeat'),
    Type.Literal('draw'),
  ]),
  opponentProfile: Type.String({ minLength: 1, maxLength: 50 }),
});

/**
 * Union discriminada para el payload de entrada de POST /api/matches.
 */
export const CreateMatchInputSchema = Type.Union([
  CreateTrainingMatchInputSchema,
  CreateBattleMatchInputSchema,
]);

export type CreateMatchInput = Static<typeof CreateMatchInputSchema>;

/**
 * Registro persistido de partida en modo Entrenamiento.
 */
export const TrainingMatchRecordSchema = Type.Object({
  id: UuidType(),
  ...BaseMatchFields,
  mode: Type.Literal('training'),
  result: Type.Literal('finished'),
  opponentProfile: Type.Null(),
  createdAt: Type.String(),
});

/**
 * Registro persistido de partida en modo Batalla.
 */
export const BattleMatchRecordSchema = Type.Object({
  id: UuidType(),
  ...BaseMatchFields,
  mode: Type.Literal('battle'),
  result: Type.Union([
    Type.Literal('victory'),
    Type.Literal('defeat'),
    Type.Literal('draw'),
  ]),
  opponentProfile: Type.String({ minLength: 1, maxLength: 50 }),
  createdAt: Type.String(),
});

/**
 * Registro completo de partida devuelto por la API.
 */
export const MatchRecordSchema = Type.Union([
  TrainingMatchRecordSchema,
  BattleMatchRecordSchema,
]);

export type MatchRecord = Static<typeof MatchRecordSchema>;

/**
 * Query params para GET /api/matches (Historial por jugador).
 */
export const GetMatchesQuerySchema = Type.Object({
  playerId: UuidType(),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export type GetMatchesQuery = Static<typeof GetMatchesQuerySchema>;

/**
 * Entrada individual de ranking.
 */
export const RankingEntrySchema = Type.Object({
  rank: Type.Integer({ minimum: 1 }),
  playerId: UuidType(),
  playerName: Type.String({ minLength: 1, maxLength: 30 }),
  score: Type.Integer({ minimum: 0 }),
  linesCleared: Type.Integer({ minimum: 0 }),
  level: Type.Integer({ minimum: 1 }),
  durationMs: Type.Integer({ minimum: 0 }),
  mode: GameModeSchema,
  createdAt: Type.String(),
});

export type RankingEntry = Static<typeof RankingEntrySchema>;

/**
 * Query params para GET /api/ranking (Ranking por modo).
 */
export const GetRankingQuerySchema = Type.Object({
  mode: GameModeSchema,
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export type GetRankingQuery = Static<typeof GetRankingQuerySchema>;
