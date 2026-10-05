import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger } from './app.setup.js';
import { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app);
  }

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
