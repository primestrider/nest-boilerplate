import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../../common/errors/app.exception.js';
import type { Env } from '../../config/env.js';
import {
  isUniqueViolation,
  type DatabaseAdapter,
} from '../../infrastructure/database/database.js';
import type { User } from '../../infrastructure/database/schema/index.js';
import { UsersRepository } from '../users/users.repository.js';
import type { AuthTokensDto, LoginDto, RegisterDto } from './auth.dto.js';
import type { AccessTokenPayload } from './auth-user.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const invalidRefreshToken = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'INVALID_REFRESH_TOKEN',
    'Invalid refresh token',
  );

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly jwt: JwtService,
    private readonly txHost: TransactionHost<DatabaseAdapter>,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = Math.floor(
      config.get('JWT_ACCESS_TTL', { infer: true }) / 1000,
    );
    this.refreshTtlMs = config.get('JWT_REFRESH_TTL', { infer: true });
  }

  @Transactional()
  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.users.create({ email: dto.email, passwordHash });
      return await this.issueTokens(user, uuidv7());
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'EMAIL_ALREADY_REGISTERED',
          'Email is already registered',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.users.findByEmail(dto.email);
    // Verify against a dummy hash for unknown emails so response time does
    // not reveal which emails are registered.
    const hash = user?.passwordHash ?? (await this.getDummyPasswordHash());
    const valid = await argon2.verify(hash, dto.password);
    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }
    return this.issueTokens(user, uuidv7());
  }

  /**
   * Rotates a refresh token. Each token is single-use: presenting one that
   * was already rotated means it leaked, so the whole session is revoked.
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const record = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (!record || (!record.revokedAt && record.expiresAt <= new Date())) {
      throw invalidRefreshToken();
    }

    const tokens = record.revokedAt
      ? null
      : await this.txHost.withTransaction(async () => {
          if (!(await this.refreshTokens.revoke(record.id))) return null;
          const user = await this.users.findById(record.userId);
          return user ? this.issueTokens(user, record.familyId) : null;
        });

    if (!tokens) {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw invalidRefreshToken();
    }
    return tokens;
  }

  /** Ends the session the token belongs to. Unknown tokens are ignored. */
  async logout(refreshToken: string): Promise<void> {
    const record = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (record) await this.refreshTokens.revokeFamily(record.familyId);
  }

  private async issueTokens(
    user: User,
    familyId: string,
  ): Promise<AuthTokensDto> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const refreshToken = randomBytes(32).toString('base64url');

    await this.refreshTokens.create({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    });

    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
    };
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= argon2.hash(randomBytes(16).toString('hex'));
    return this.dummyPasswordHash;
  }
}
