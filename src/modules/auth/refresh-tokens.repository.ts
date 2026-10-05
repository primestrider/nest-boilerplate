import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../infrastructure/database/database.js';
import {
  refreshTokens,
  type RefreshToken,
} from '../../infrastructure/database/schema/index.js';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async create(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.txHost.tx.insert(refreshTokens).values(data);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const [token] = await this.txHost.tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return token;
  }

  /**
   * Marks a token as used. Returns false if it was already revoked, which
   * also covers two concurrent refreshes racing for the same token.
   */
  async revoke(id: string): Promise<boolean> {
    const [result] = await this.txHost.tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
    return result.affectedRows === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.txHost.tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }
}
