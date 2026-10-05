import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Env } from './config/env.js';

/**
 * HTTP-level setup shared by `main.ts` and e2e tests, so tests exercise the
 * same routing and security headers as production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    // Required for the refresh-token cookie sent by web clients.
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Nest Boilerplate API')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
