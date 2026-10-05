import { validateEnv } from './env.js';

const required = {
  DATABASE_URL: 'mysql://app:app@localhost:3306/app',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(required)).toEqual({
      ...required,
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
      TRUST_PROXY: 0,
      LOG_LEVEL: 'info',
      JWT_ACCESS_TTL: 15 * 60 * 1000,
      JWT_REFRESH_TTL: 30 * 24 * 60 * 60 * 1000,
    });
  });

  it('parses comma-separated origins, string booleans and durations', () => {
    const env = validateEnv({
      ...required,
      CORS_ORIGINS: 'http://a.test, http://b.test,',
      SWAGGER_ENABLED: 'false',
      JWT_ACCESS_TTL: '5m',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.JWT_ACCESS_TTL).toBe(5 * 60 * 1000);
  });

  it('rejects invalid values', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc' })).toThrow(
      /Invalid environment variables/,
    );
    expect(() => validateEnv({ ...required, JWT_ACCESS_TTL: 'soon' })).toThrow(
      /JWT_ACCESS_TTL/,
    );
  });

  it('requires a MySQL/MariaDB database url', () => {
    expect(() => validateEnv({ ...required, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      validateEnv({
        ...required,
        DATABASE_URL: 'postgres://u:p@localhost/app',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('disables Swagger by default in production only', () => {
    expect(
      validateEnv({ ...required, NODE_ENV: 'production' }).SWAGGER_ENABLED,
    ).toBe(false);
    expect(
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
      }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('treats empty variables as unset', () => {
    const env = validateEnv({ ...required, SWAGGER_ENABLED: '', PORT: '' });
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.PORT).toBe(3000);
    expect(() => validateEnv({ ...required, JWT_ACCESS_SECRET: '' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('requires a strong JWT secret', () => {
    expect(() =>
      validateEnv({ ...required, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
