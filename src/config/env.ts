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

const envSchema = z
  .object({
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
    // Defaults to off in production (see the transform below).
    SWAGGER_ENABLED: z.stringbool().optional(),
    // Number of reverse proxies / load balancers in front of the app (0 = none).
    // Too high lets clients spoof their IP via X-Forwarded-For.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // e.g. mysql://user:pass@localhost:3306/app?connectionLimit=10&queueLimit=100
    DATABASE_URL: z.url({ protocol: /^(mysql|mariadb)$/ }),
    // Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: duration('15m'),
    JWT_REFRESH_TTL: duration('30d'),
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  // `FOO=` (common in .env files and compose) means "unset", so it falls back
  // to the default instead of failing validation as an empty string.
  const defined = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const result = envSchema.safeParse(defined);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
