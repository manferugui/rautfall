import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;

export type AppDatabase = NodePgDatabase<typeof schema>;

export function createDatabaseConnection(connectionString: string): {
  db: AppDatabase;
  pool: pg.Pool;
} {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });

  return { db, pool };
}
