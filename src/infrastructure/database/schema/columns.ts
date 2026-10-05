import { sql } from 'drizzle-orm';
import { char, datetime } from 'drizzle-orm/mysql-core';
import { v7 as uuidv7 } from 'uuid';

// CHAR(36) works on both MySQL and MariaDB (only MariaDB has a UUID type).
// UUIDv7 is time-ordered, so inserts stay append-only in the InnoDB index.
export const uuid = (name: string) => char(name, { length: 36 });

export const uuidPrimaryKey = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

// DATETIME instead of TIMESTAMP: MySQL TIMESTAMP overflows in 2038.
export const timestamps = {
  createdAt: datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: datetime('updated_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date()),
};
