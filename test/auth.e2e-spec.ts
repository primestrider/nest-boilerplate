import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import {
  DRIZZLE,
  type Database,
} from './../src/infrastructure/database/database.js';
import { users } from './../src/infrastructure/database/schema/index.js';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let db: Database;
  const password = 'correct-horse-battery';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const newEmail = () => `user-${randomUUID()}@test.local`;
  const register = (email = newEmail()) =>
    api().post('/api/v1/auth/register').send({ email, password }).expect(201);

  describe('register', () => {
    it('creates a user and returns a token pair', async () => {
      const { body } = await register();
      expect(body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    });

    it('normalizes email and rejects duplicates with 409', async () => {
      const email = newEmail();
      await register(email);
      await api()
        .post('/api/v1/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password })
        .expect(409)
        .expect(({ body }) =>
          expect(body.code).toBe('EMAIL_ALREADY_REGISTERED'),
        );
    });

    it('validates input', async () => {
      const { body } = await api()
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', extra: true })
        .expect(400);
      expect(body).toMatchObject({
        status: 400,
        code: 'VALIDATION_FAILED',
        detail: 'Validation failed',
      });
      expect(body.errors).toEqual(
        expect.arrayContaining([
          {
            field: 'extra',
            code: 'whitelistValidation',
            message: 'property extra should not exist',
          },
          {
            field: 'email',
            code: 'isEmail',
            message: 'email must be an email',
          },
          {
            field: 'password',
            code: 'minLength',
            message: 'password must be longer than or equal to 8 characters',
          },
        ]),
      );
    });
  });

  describe('login', () => {
    it('accepts valid credentials', async () => {
      const email = newEmail();
      await register(email);
      await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const email = newEmail();
      await register(email);
      const wrongPassword = await api()
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
      const unknownEmail = await api()
        .post('/api/v1/auth/login')
        .send({ email: newEmail(), password })
        .expect(401);
      expect(wrongPassword.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(unknownEmail.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail);
    });
  });

  describe('protected routes', () => {
    it('returns the current user without the password hash', async () => {
      const email = newEmail();
      const { body: tokens } = await register(email);
      const { body } = await api()
        .get('/api/v1/users/me')
        .auth(tokens.accessToken, { type: 'bearer' })
        .expect(200);

      expect(body).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/),
        email,
        role: 'user',
        createdAt: expect.any(String),
      });
    });

    it('rejects missing and invalid access tokens', async () => {
      await api().get('/api/v1/users/me').expect(401);
      await api()
        .get('/api/v1/users/me')
        .auth('not-a-jwt', { type: 'bearer' })
        .expect(401);
    });

    it('restricts the user list to admins', async () => {
      const email = newEmail();
      const { body: userTokens } = await register(email);
      await api()
        .get('/api/v1/users')
        .auth(userTokens.accessToken, { type: 'bearer' })
        .expect(403);

      // Role is read from the token, so log in again after promotion.
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.email, email));
      const { body: adminTokens } = await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      const { body } = await api()
        .get('/api/v1/users?page=1&limit=2')
        .auth(adminTokens.accessToken, { type: 'bearer' })
        .expect(200);
      expect(body.data).toHaveLength(2);
      expect(body.meta).toMatchObject({ page: 1, limit: 2 });
      expect(body.meta.total).toBeGreaterThanOrEqual(2);
      expect(body.data[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh token rotation', () => {
    const refresh = (refreshToken: string) =>
      api().post('/api/v1/auth/refresh').send({ refreshToken });

    it('issues a new pair and invalidates the old refresh token', async () => {
      const { body: first } = await register();
      const { body: second } = await refresh(first.refreshToken).expect(200);
      expect(second.refreshToken).not.toBe(first.refreshToken);

      await api()
        .get('/api/v1/users/me')
        .auth(second.accessToken, { type: 'bearer' })
        .expect(200);
    });

    it('revokes the whole session when a used token is replayed', async () => {
      const { body: first } = await register();
      const { body: second } = await refresh(first.refreshToken).expect(200);

      // Replaying the rotated token signals theft...
      await refresh(first.refreshToken).expect(401);
      // ...so the legitimate successor stops working too.
      await refresh(second.refreshToken).expect(401);
    });

    it('lets only one of two concurrent refreshes succeed', async () => {
      const { body } = await register();
      const results = await Promise.all([
        refresh(body.refreshToken),
        refresh(body.refreshToken),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 401,
      ]);
    });

    it('rejects unknown tokens', async () => {
      const { body } = await refresh('unknown-token').expect(401);
      expect(body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('logout', () => {
    it('ends the session', async () => {
      const { body } = await register();
      await api()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: body.refreshToken })
        .expect(204);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });
  });
});
