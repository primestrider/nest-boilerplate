import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp, setupSwagger } from './../src/app.setup.js';

describe('Swagger (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the problem details error response on every operation', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(body.components.schemas.ProblemDetailsDto.required).toEqual(
      expect.arrayContaining(['type', 'title', 'status', 'detail', 'code']),
    );
    const operations = Object.values(body.paths).flatMap((pathItem) =>
      Object.values(pathItem as Record<string, { responses: object }>),
    );
    expect(operations.length).toBeGreaterThan(0);
    for (const operation of operations) {
      expect(operation.responses).toHaveProperty(
        ['default', 'content', 'application/problem+json', 'schema', '$ref'],
        '#/components/schemas/ProblemDetailsDto',
      );
    }
  });
});
