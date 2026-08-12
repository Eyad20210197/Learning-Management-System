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
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_TTL_SECONDS: number;
  MAX_REGISTERED_DEVICES: number;
  PASSWORD_RESET_TTL_SECONDS: number;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  OBJECT_STORAGE_ENDPOINT: string;
  OBJECT_STORAGE_REGION: string;
  OBJECT_STORAGE_ACCESS_KEY_ID: string;
  OBJECT_STORAGE_SECRET_ACCESS_KEY: string;
  OBJECT_STORAGE_BUCKET: string;
  OBJECT_STORAGE_FORCE_PATH_STYLE: boolean;
  OBJECT_STORAGE_UPLOAD_TTL_SECONDS: number;
  MAX_VIDEO_UPLOAD_BYTES: number;
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

const requireProductionEmail = (
  value: EnvironmentVariables,
  helpers: CustomHelpers,
): EnvironmentVariables | ReturnType<CustomHelpers['error']> => {
  if (value.NODE_ENV !== 'production') return value;
  const required = [
    value.SMTP_HOST,
    value.SMTP_PORT,
    value.SMTP_USER,
    value.SMTP_PASSWORD,
    value.SMTP_FROM,
  ];
  return required.every((entry) => entry !== undefined && entry !== '')
    ? value
    : helpers.error('smtp.production');
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
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number()
    .integer()
    .min(3600)
    .max(31_536_000)
    .default(2_592_000),
  MAX_REGISTERED_DEVICES: Joi.number().integer().min(1).max(100).default(5),
  PASSWORD_RESET_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(86_400)
    .default(3600),
  SMTP_HOST: Joi.string().hostname().optional(),
  SMTP_PORT: Joi.number().integer().min(1).max(65535).optional(),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SMTP_FROM: Joi.string().email().optional(),
  OBJECT_STORAGE_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  OBJECT_STORAGE_REGION: Joi.string().min(1).default('auto'),
  OBJECT_STORAGE_ACCESS_KEY_ID: Joi.string().min(3).required(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: Joi.string().min(8).required(),
  OBJECT_STORAGE_BUCKET: Joi.string().min(3).max(63).required(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  OBJECT_STORAGE_UPLOAD_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(900),
  MAX_VIDEO_UPLOAD_BYTES: Joi.number()
    .integer()
    .min(1_048_576)
    .max(5_497_558_138_880)
    .default(10_737_418_240),
})
  .custom(requireProductionEmail, 'production SMTP validation')
  .messages({
    'smtp.production':
      'Production requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM',
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
