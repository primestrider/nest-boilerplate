import { sql } from 'drizzle-orm';
import { char, datetime, index, mysqlTable } from 'drizzle-orm/mysql-core';
import { uuid, uuidPrimaryKey } from './columns.js';
import { users } from './users.schema.js';

/**
 * Opaque, single-use refresh tokens. Only a SHA-256 hash is stored, so a
 * leaked table cannot be replayed. Every token issued from one login shares a
 * `familyId`; reusing a rotated token revokes the whole family.
 */
export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
    revokedAt: datetime('revoked_at', { fsp: 3 }),
    createdAt: datetime('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
