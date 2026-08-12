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
}));
