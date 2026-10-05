import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('renders errors as RFC 9457 problem details', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist?token=secret')
      .expect(404)
      .expect('Content-Type', /^application\/problem\+json/);

    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Cannot GET /api/v1/does-not-exist?token=secret',
      code: 'NOT_FOUND',
      // Query string stripped: it can carry secrets.
      instance: '/api/v1/does-not-exist',
      requestId: res.headers['x-request-id'],
    });
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('reuses a valid incoming request id and replaces an unsafe one', async () => {
    const server = app.getHttpServer();

    const kept = await request(server)
      .get('/api/v1')
      .set('x-request-id', 'upstream-123');
    expect(kept.headers['x-request-id']).toBe('upstream-123');

    const replaced = await request(server)
      .get('/api/v1')
      .set('x-request-id', 'bad id with spaces');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('/api/health/live (GET) checks no dependencies', () => {
    return request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ status: 'ok', info: {} }),
      );
  });

  it('/api/health/ready (GET) checks the database', () => {
    return request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          status: 'ok',
          info: { database: { status: 'up' } },
        }),
      );
  });

  it('answers an oversized body with 413, not 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) })
      .expect(413);

    expect(res.body).toMatchObject({
      status: 413,
      title: 'Payload Too Large',
      code: 'PAYLOAD_TOO_LARGE',
      requestId: res.headers['x-request-id'],
    });
  });

  it('answers malformed JSON with 400 and a request id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": bad')
      .expect(400);

    expect(res.body).toMatchObject({
      code: 'BAD_REQUEST',
      requestId: res.headers['x-request-id'],
    });
  });

  it('trusts the configured number of proxies', () => {
    // TRUST_PROXY=1 in the e2e env: req.ip comes from X-Forwarded-For.
    expect(app.getHttpAdapter().getInstance().get('trust proxy')).toBe(1);
  });

  afterEach(async () => {
    await app.close();
  });
});
