import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, getSchemaPath, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemDetailsDto } from './common/errors/problem-details.dto.js';
import { PROBLEM_CONTENT_TYPE } from './common/filters/all-exceptions.filter.js';
import { requestIdMiddleware } from './common/middleware/request-id.js';
import { Env } from './config/env.js';

/**
 * HTTP-level setup shared by `main.ts` and e2e tests, so tests exercise the
 * same routing and security headers as production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const trustProxy = config.get('TRUST_PROXY', { infer: true });

  if (trustProxy > 0) {
    // Number of proxies in front of the app; makes `req.ip` (used by the rate
    // limiter and logs) the real client IP instead of the proxy's.
    app.set('trust proxy', trustProxy);
  }
  // Registered before Nest's body parser so parse errors carry the id too.
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({ origin: corsOrigins.length > 0 ? corsOrigins : false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Nest Boilerplate API')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
    { extraModels: [ProblemDetailsDto] },
  );

  // Every endpoint can fail with the same RFC 9457 body; document it once
  // instead of decorating each handler.
  const problemResponse = {
    description: 'Error (RFC 9457 Problem Details)',
    content: {
      [PROBLEM_CONTENT_TYPE]: {
        schema: { $ref: getSchemaPath(ProblemDetailsDto) },
      },
    },
  };
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) operation.responses.default ??= problemResponse;
    }
  }

  SwaggerModule.setup('docs', app, document);
}
