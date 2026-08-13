import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '@lms/platform';
import { withDependencyTimeout } from './dependency-timeout';

@Injectable()
export class QueueHealthIndicator {
  private readonly logger = new Logger(QueueHealthIndicator.name);

  constructor(
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly queue: Queue,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy(): Promise<HealthIndicatorResult<'videoQueue'>> {
    const check = this.indicator.check('videoQueue');
    try {
      const counts = await withDependencyTimeout(
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        'Video queue',
      );
      return check.up(counts);
    } catch (error: unknown) {
      this.logger.warn(
        `Video queue health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return check.down('Video queue is unavailable');
    }
  }
}
