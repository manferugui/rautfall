import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientMatchId: uuid('client_match_id').notNull(),
    playerId: uuid('player_id').notNull(),
    playerName: varchar('player_name', { length: 30 }).notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    result: varchar('result', { length: 20 }).notNull(),
    score: integer('score').notNull(),
    linesCleared: integer('lines_cleared').notNull(),
    durationMs: integer('duration_ms').notNull(),
    level: integer('level').notNull(),
    opponentProfile: varchar('opponent_profile', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_matches_client_match_id_unique').on(table.clientMatchId),
    index('idx_matches_history').on(table.playerId, table.createdAt.desc(), table.id.desc()),
    index('idx_matches_ranking').on(table.mode, table.score.desc(), table.createdAt.asc(), table.id.asc()),
  ],
);

export type DbMatch = typeof matches.$inferSelect;
export type NewDbMatch = typeof matches.$inferInsert;
