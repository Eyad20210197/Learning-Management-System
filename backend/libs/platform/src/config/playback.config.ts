import { registerAs } from '@nestjs/config';

export interface PlaybackConfig {
  leasePrivateKey: string;
  leaseTtlSeconds: number;
  heartbeatIntervalSeconds: number;
  staleAfterSeconds: number;
  redisPrefix: string;
}

export const playbackConfig = registerAs('playback', (): PlaybackConfig => ({
  leasePrivateKey: process.env.MEDIA_LEASE_PRIVATE_KEY ?? '',
  leaseTtlSeconds: Number.parseInt(
    process.env.MEDIA_LEASE_TTL_SECONDS ?? '90',
    10,
  ),
  heartbeatIntervalSeconds: Number.parseInt(
    process.env.PLAYBACK_HEARTBEAT_INTERVAL_SECONDS ?? '30',
    10,
  ),
  staleAfterSeconds: Number.parseInt(
    process.env.PLAYBACK_STALE_AFTER_SECONDS ?? '120',
    10,
  ),
  redisPrefix: process.env.PLAYBACK_REDIS_PREFIX ?? 'lms:playback',
}));
