import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/does-not-exist',
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  afterEach(async () => {
    await app.close();
  });
});
