import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createPool } from 'mysql2/promise';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');

export const MIGRATIONS_FOLDER = 'drizzle';

// mysql2 queues requests for a free connection without limit by default, so
// a slow or unreachable database lets waiting requests pile up in memory.
// Applied via the URL so DATABASE_URL query params can still override it.
const POOL_DEFAULTS = { queueLimit: '100' };

export function createDatabase(url: string) {
  const uri = new URL(url);
  for (const [key, value] of Object.entries(POOL_DEFAULTS)) {
    if (!uri.searchParams.has(key)) uri.searchParams.set(key, value);
  }

  const pool = createPool({
    uri: uri.toString(),
    // Read and write DATETIME values as UTC regardless of the host timezone.
    timezone: 'Z',
  });
  return drizzle({ client: pool, schema, mode: 'default' });
}

export type Database = ReturnType<typeof createDatabase>;

/** Inject as `TransactionHost<DatabaseAdapter>` to join the active transaction. */
export type DatabaseAdapter = TransactionalAdapterDrizzleOrm<Database>;

/** True for a duplicate-key error (Drizzle wraps the driver error in `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  return (cause as { code?: unknown } | null)?.code === 'ER_DUP_ENTRY';
}

export async function runMigrations(url: string): Promise<void> {
  const db = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
}
