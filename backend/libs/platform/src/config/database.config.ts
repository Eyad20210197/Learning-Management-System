import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  poolMax: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL as string,
  poolMax: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
}));
