import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { assignRequestId } from '../../common/middleware/request-id.js';
import { Env } from '../../config/env.js';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isDevelopment =
          config.get('NODE_ENV', { infer: true }) === 'development';

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            genReqId: assignRequestId,
            // Client IP as resolved by Express (honours TRUST_PROXY), unlike
            // `remoteAddress`, which is the immediate peer (e.g. the proxy).
            customProps: (req) => ({ ip: (req as { ip?: string }).ip }),
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            // Probes hit health checks constantly; logging them is noise.
            autoLogging: {
              ignore: (req) => req.url?.startsWith('/api/health') ?? false,
            },
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            transport: isDevelopment
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
