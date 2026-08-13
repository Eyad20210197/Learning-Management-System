import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule, RedisModule, VideoQueueModule } from '@lms/platform';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { QueueHealthIndicator } from './indicators/queue-health.indicator';

@Module({
  imports: [TerminusModule, DatabaseModule, RedisModule, VideoQueueModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    QueueHealthIndicator,
  ],
})
export class HealthModule {}
