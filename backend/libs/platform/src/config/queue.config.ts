import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  prefix: string;
}

export const queueConfig = registerAs('queue', (): QueueConfig => ({
  prefix: process.env.VIDEO_QUEUE_PREFIX ?? 'lms',
}));
