import { eq, desc, sql } from 'drizzle-orm';
import type { CreateMatchInput, MatchRecord, RankingEntry } from '@rautfall/contracts';
import { matches, type DbMatch } from '../db/schema.js';
import type { AppDatabase } from '../db/index.js';
import { AppError } from '../errors/app-error.js';

export interface MatchesRepository {
  /**
   * Persiste una nueva partida o devuelve la existente si clientMatchId ya fue registrado.
   * @returns `isNew`: boolean (true si fue insertada, false si ya existía), `match`: MatchRecord.
   */
  saveMatch(input: CreateMatchInput): Promise<{ isNew: boolean; match: MatchRecord }>;

  /**
   * Obtiene el historial de partidas recientes de un jugador específico.
   */
  getMatchHistory(playerId: string, limit: number): Promise<MatchRecord[]>;

  /**
   * Obtiene la mejor puntuación por jugador en un modo de juego.
   */
  getRanking(mode: 'training' | 'battle', limit: number): Promise<RankingEntry[]>;
}

function matchesInputPayload(row: DbMatch, input: CreateMatchInput): boolean {
  const inputOpponent = input.opponentProfile ?? null;
  const dbOpponent = row.opponentProfile ?? null;
  return (
    row.playerId === input.playerId &&
    row.playerName === input.playerName &&
    row.mode === input.mode &&
    row.result === input.result &&
    row.score === input.score &&
    row.linesCleared === input.linesCleared &&
    row.durationMs === input.durationMs &&
    row.level === input.level &&
    dbOpponent === inputOpponent
  );
}

export function createMatchesRepository(db: AppDatabase): MatchesRepository {
  function mapDbToRecord(row: DbMatch): MatchRecord {
    const base = {
      id: row.id,
      clientMatchId: row.clientMatchId,
      playerId: row.playerId,
      playerName: row.playerName,
      score: row.score,
      linesCleared: row.linesCleared,
      durationMs: row.durationMs,
      level: row.level,
      createdAt: row.createdAt.toISOString(),
    };

    if (row.mode === 'training') {
      return {
        ...base,
        mode: 'training',
        result: 'finished',
        opponentProfile: null,
      };
    }

    return {
      ...base,
      mode: 'battle',
      result: row.result as 'victory' | 'defeat' | 'draw',
      opponentProfile: row.opponentProfile ?? 'bot-deterministic-v1',
    };
  }

  return {
    async saveMatch(input: CreateMatchInput): Promise<{ isNew: boolean; match: MatchRecord }> {
      // 1. Verificación previa de idempotencia por clientMatchId
      const existing = await db
        .select()
        .from(matches)
        .where(eq(matches.clientMatchId, input.clientMatchId))
        .limit(1);

      if (existing.length > 0 && existing[0]) {
        if (!matchesInputPayload(existing[0], input)) {
          throw new AppError(
            409,
            'MATCH_IDEMPOTENCY_CONFLICT',
            'El clientMatchId especificado ya existe pero con un payload contractual diferente.',
          );
        }
        return { isNew: false, match: mapDbToRecord(existing[0]) };
      }

      // 2. Intentar inserción
      try {
        const [inserted] = await db
          .insert(matches)
          .values({
            clientMatchId: input.clientMatchId,
            playerId: input.playerId,
            playerName: input.playerName,
            mode: input.mode,
            result: input.result,
            score: input.score,
            linesCleared: input.linesCleared,
            durationMs: input.durationMs,
            level: input.level,
            opponentProfile: input.opponentProfile ?? null,
          })
          .returning();

        if (!inserted) {
          throw new Error('Failed to insert match record');
        }

        return { isNew: true, match: mapDbToRecord(inserted) };
      } catch (err: unknown) {
        // Fallback defensivo si ocurre unique violation simultáneo por condición de carrera
        const fallback = await db
          .select()
          .from(matches)
          .where(eq(matches.clientMatchId, input.clientMatchId))
          .limit(1);

        if (fallback.length > 0 && fallback[0]) {
          if (!matchesInputPayload(fallback[0], input)) {
            throw new AppError(
              409,
              'MATCH_IDEMPOTENCY_CONFLICT',
              'El clientMatchId especificado ya existe pero con un payload contractual diferente.',
            );
          }
          return { isNew: false, match: mapDbToRecord(fallback[0]) };
        }

        throw err;
      }
    },

    async getMatchHistory(playerId: string, limit: number): Promise<MatchRecord[]> {
      const safeLimit = Math.max(1, Math.min(100, limit));
      const rows = await db
        .select()
        .from(matches)
        .where(eq(matches.playerId, playerId))
        .orderBy(desc(matches.createdAt), desc(matches.id))
        .limit(safeLimit);

      return rows.map(mapDbToRecord);
    },

    async getRanking(mode: 'training' | 'battle', limit: number): Promise<RankingEntry[]> {
      const safeLimit = Math.max(1, Math.min(100, limit));

      // Consulta de agregación por mejor partida por jugador con tie-break (score DESC, createdAt ASC, id ASC)
      const query = sql`
        WITH ranked_matches AS (
          SELECT
            id,
            player_id,
            player_name,
            mode,
            score,
            lines_cleared,
            level,
            duration_ms,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY player_id
              ORDER BY score DESC, created_at ASC, id ASC
            ) as rn
          FROM ${matches}
          WHERE mode = ${mode}
        )
        SELECT
          id,
          player_id,
          player_name,
          mode,
          score,
          lines_cleared,
          level,
          duration_ms,
          created_at
        FROM ranked_matches
        WHERE rn = 1
        ORDER BY score DESC, created_at ASC, id ASC
        LIMIT ${safeLimit}
      `;

      const result = await db.execute(query);
      const rows = result.rows as Array<{
        id: string;
        player_id: string;
        player_name: string;
        mode: string;
        score: number;
        lines_cleared: number;
        level: number;
        duration_ms: number;
        created_at: Date | string;
      }>;

      return rows.map((row, index) => ({
        rank: index + 1,
        playerId: row.player_id,
        playerName: row.player_name,
        score: Number(row.score),
        linesCleared: Number(row.lines_cleared),
        level: Number(row.level),
        durationMs: Number(row.duration_ms),
        mode: row.mode as 'training' | 'battle',
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
  };
}
