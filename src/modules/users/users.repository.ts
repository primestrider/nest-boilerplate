import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { desc, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../infrastructure/database/database.js';
import {
  users,
  type NewUser,
  type User,
} from '../../infrastructure/database/schema/index.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.txHost.tx
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.txHost.tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  /** Throws a unique violation (see `isUniqueViolation`) if the email exists. */
  async create(data: NewUser): Promise<User> {
    // MySQL has no RETURNING; read the row back to get DB defaults.
    const [{ id }] = await this.txHost.tx
      .insert(users)
      .values(data)
      .$returningId();
    return (await this.findById(id))!;
  }

  async list(options: {
    limit: number;
    offset: number;
  }): Promise<{ items: User[]; total: number }> {
    const [items, total] = await Promise.all([
      this.txHost.tx
        .select()
        .from(users)
        // UUIDv7 ids are time-ordered, so this is newest first.
        .orderBy(desc(users.id))
        .limit(options.limit)
        .offset(options.offset),
      this.txHost.tx.$count(users),
    ]);
    return { items, total };
  }
}
