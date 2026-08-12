import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const requiredVariables = {
    DATABASE_URL: 'postgresql://lms:password@localhost:5432/lms',
    REDIS_URL: 'redis://localhost:6379/0',
  };

  it('applies safe defaults and coerces primitive values', () => {
    const environment = validateEnvironment(requiredVariables);

    expect(environment).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 3000,
      APP_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'info',
      API_DOCS_ENABLED: false,
      DATABASE_POOL_MAX: 10,
      VIDEO_QUEUE_PREFIX: 'lms',
    });
  });

  it('reports all missing required infrastructure variables', () => {
    expect(() => validateEnvironment({})).toThrow(/DATABASE_URL.*REDIS_URL/s);
  });

  it('rejects CORS entries that are not origins', () => {
    expect(() =>
      validateEnvironment({
        ...requiredVariables,
        CORS_ORIGINS: 'https://lms.example.com/path',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });
});
