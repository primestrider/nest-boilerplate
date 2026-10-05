import { mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { timestamps, uuidPrimaryKey } from './columns.js';

export const userRoles = ['user', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const users = mysqlTable('users', {
  id: uuidPrimaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: mysqlEnum('role', userRoles).notNull().default('user'),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
