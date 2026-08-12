import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  uploadTtlSeconds: number;
  maxVideoBytes: number;
}

export const storageConfig = registerAs('storage', (): StorageConfig => ({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? '',
  region: process.env.OBJECT_STORAGE_REGION ?? 'auto',
  accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.OBJECT_STORAGE_BUCKET ?? '',
  forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  uploadTtlSeconds: Number.parseInt(
    process.env.OBJECT_STORAGE_UPLOAD_TTL_SECONDS ?? '900',
    10,
  ),
  maxVideoBytes: Number.parseInt(
    process.env.MAX_VIDEO_UPLOAD_BYTES ?? '10737418240',
    10,
  ),
}));
