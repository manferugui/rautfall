import 'dotenv/config';
import { createDatabaseConnection } from './index.js';
import { runMigrations } from './migrate.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/rautfall';
  console.log(`[db:migrate] Conectando a PostgreSQL en ${databaseUrl}...`);

  const { db, pool } = createDatabaseConnection(databaseUrl);
  try {
    await runMigrations(db);
    console.log('[db:migrate] Migraciones aplicadas correctamente ✓');
  } catch (err) {
    console.error('[db:migrate] Error aplicando migraciones:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
