import { registerAs } from '@nestjs/config';

export type NodeEnvironment = 'development' | 'test' | 'production';
export type LogLevel =
  'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  url: string;
  corsOrigins: string[];
  logLevel: LogLevel;
  apiDocsEnabled: boolean;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTokenSecret: string;
  refreshTokenTtlSeconds: number;
  maxRegisteredDevices: number;
  passwordResetTtlSeconds: number;
  smtp: {
    host?: string;
    port?: number;
    secure: boolean;
    user?: string;
    password?: string;
    from?: string;
  };
}

const parseBoolean = (value: string | undefined): boolean => value === 'true';

export const appConfig = registerAs('app', (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV ?? 'development') as NodeEnvironment,
  port: Number.parseInt(process.env.API_PORT ?? '3000', 10),
  url: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as LogLevel,
  apiDocsEnabled: parseBoolean(process.env.API_DOCS_ENABLED),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  jwtAccessTtlSeconds: Number.parseInt(
    process.env.JWT_ACCESS_TTL_SECONDS ?? '900',
    10,
  ),
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET ?? '',
  refreshTokenTtlSeconds: Number.parseInt(
    process.env.REFRESH_TOKEN_TTL_SECONDS ?? '2592000',
    10,
  ),
  maxRegisteredDevices: Number.parseInt(
    process.env.MAX_REGISTERED_DEVICES ?? '5',
    10,
  ),
  passwordResetTtlSeconds: Number.parseInt(
    process.env.PASSWORD_RESET_TTL_SECONDS ?? '3600',
    10,
  ),
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT
      ? Number.parseInt(process.env.SMTP_PORT, 10)
      : undefined,
    secure: parseBoolean(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },
}));
