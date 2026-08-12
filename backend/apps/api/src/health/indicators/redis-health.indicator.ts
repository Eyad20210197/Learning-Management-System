import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '@lms/platform';
import { withDependencyTimeout } from './dependency-timeout';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly redis: RedisService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy(): Promise<HealthIndicatorResult<'redis'>> {
    const check = this.indicator.check('redis');

    try {
      await withDependencyTimeout(this.redis.ping(), 'Redis');
      return check.up();
    } catch (error: unknown) {
      this.logger.warn(
        `Redis health check failed: ${this.errorMessage(error)}`,
      );
      return check.down('Redis is unavailable');
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
