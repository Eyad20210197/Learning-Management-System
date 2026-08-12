import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const requiredVariables = {
    DATABASE_URL: 'postgresql://lms:password@localhost:5432/lms',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-characters',
    OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:9000',
    OBJECT_STORAGE_ACCESS_KEY_ID: 'test-access-key',
    OBJECT_STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
    OBJECT_STORAGE_BUCKET: 'lms-test-private',
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
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
      MAX_REGISTERED_DEVICES: 5,
      PASSWORD_RESET_TTL_SECONDS: 3600,
      OBJECT_STORAGE_REGION: 'auto',
      OBJECT_STORAGE_UPLOAD_TTL_SECONDS: 900,
      MAX_VIDEO_UPLOAD_BYTES: 10_737_418_240,
    });
  });

  it('reports all missing required infrastructure variables', () => {
    expect(() => validateEnvironment({})).toThrow(
      /DATABASE_URL.*REDIS_URL.*OBJECT_STORAGE_ENDPOINT/s,
    );
  });

  it('rejects CORS entries that are not origins', () => {
    expect(() =>
      validateEnvironment({
        ...requiredVariables,
        CORS_ORIGINS: 'https://lms.example.com/path',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('requires a complete SMTP configuration in production', () => {
    expect(() =>
      validateEnvironment({
        ...requiredVariables,
        NODE_ENV: 'production',
      }),
    ).toThrow(/SMTP/);
  });
});
