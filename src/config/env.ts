import ms from 'ms';
import { z } from 'zod';

/** Human-readable duration ("15m", "30d") parsed to milliseconds. */
const duration = (fallback: ms.StringValue) =>
  z
    .string()
    .default(fallback)
    .transform((value, ctx) => {
      const milliseconds = ms(value as ms.StringValue) as number | undefined;
      if (milliseconds === undefined || milliseconds <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid duration "${value}" (e.g. 15m, 7d)`,
        });
        return z.NEVER;
      }
      return milliseconds;
    });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Comma-separated list of allowed origins; empty disables CORS.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SWAGGER_ENABLED: z.stringbool().default(true),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // e.g. mysql://user:pass@localhost:3306/app?connectionLimit=10
  DATABASE_URL: z.url({ protocol: /^(mysql|mariadb)$/ }),
  // Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: duration('15m'),
  JWT_REFRESH_TTL: duration('30d'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
