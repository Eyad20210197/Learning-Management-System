import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;

  constructor(configService: ConfigService) {
    this.redisClient = new Redis(
      configService.getOrThrow<string>('redis.url'),
      {
        lazyConnect: true,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 5_000,
        connectionName: 'lms-platform',
        retryStrategy: (attempt) =>
          attempt > 10 ? null : Math.min(attempt * 200, 3_000),
      },
    );

    this.redisClient.on('error', (error: Error) => {
      this.logger.error('Redis connection error', error.stack);
    });
  }

  get client(): Redis {
    return this.redisClient;
  }

  async onModuleInit(): Promise<void> {
    if (this.redisClient.status === 'wait') {
      await this.redisClient.connect();
    }

    await this.redisClient.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient.status === 'end') {
      return;
    }

    try {
      await this.redisClient.quit();
    } catch {
      this.redisClient.disconnect(false);
    }
  }

  async ping(): Promise<void> {
    await this.redisClient.ping();
  }
}
