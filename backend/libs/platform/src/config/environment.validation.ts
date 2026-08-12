import Joi, { type CustomHelpers } from 'joi';

export interface EnvironmentVariables extends Record<string, unknown> {
  NODE_ENV: 'development' | 'test' | 'production';
  API_PORT: number;
  APP_URL: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  API_DOCS_ENABLED: boolean;
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  REDIS_URL: string;
  VIDEO_QUEUE_PREFIX: string;
}

const commaSeparatedOrigins = (
  value: string,
  helpers: CustomHelpers,
): string | ReturnType<CustomHelpers['error']> => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return helpers.error('any.invalid');
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const isHttp =
        parsed.protocol === 'http:' || parsed.protocol === 'https:';
      const hasOnlyOrigin =
        parsed.pathname === '/' &&
        parsed.search === '' &&
        parsed.hash === '' &&
        parsed.username === '' &&
        parsed.password === '';

      if (!isHttp || !hasOnlyOrigin) {
        return helpers.error('any.invalid');
      }
    } catch {
      return helpers.error('any.invalid');
    }
  }

  return origins.join(',');
};

export const environmentSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  API_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string()
    .custom(commaSeparatedOrigins, 'comma-separated CORS origin validation')
    .default('http://localhost:5173')
    .messages({
      'any.invalid':
        '{{#label}} must contain only comma-separated HTTP(S) origins without paths',
    }),
  LOG_LEVEL: Joi.string()
    .valid('silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  API_DOCS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  VIDEO_QUEUE_PREFIX: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .default('lms'),
});

export const validateEnvironment = (
  values: Record<string, unknown>,
): EnvironmentVariables => {
  const result = environmentSchema.validate(values, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

  if (result.error) {
    const details = result.error.details
      .map((detail) => detail.message)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return result.value;
};
