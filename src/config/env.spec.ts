import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
    });
  });

  it('parses comma-separated origins and string booleans', () => {
    const env = validateEnv({
      CORS_ORIGINS: 'http://a.test, http://b.test,',
      SWAGGER_ENABLED: 'false',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /Invalid environment variables/,
    );
  });
});
