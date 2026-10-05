import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createPool } from 'mysql2/promise';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');

export const MIGRATIONS_FOLDER = 'drizzle';

export function createDatabase(url: string) {
  const pool = createPool({
    uri: url,
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
