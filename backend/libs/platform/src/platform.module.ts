import { Module } from '@nestjs/common';
import { PlatformConfigModule } from './config';
import { DatabaseModule } from './database';
import { ObservabilityModule } from './observability';
import { VideoQueueModule } from './queue';
import { RedisModule } from './redis';
import { PlatformSchedulingModule } from './scheduling';

@Module({
  imports: [
    PlatformConfigModule,
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    VideoQueueModule,
    PlatformSchedulingModule,
  ],
  exports: [
    PlatformConfigModule,
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    VideoQueueModule,
    PlatformSchedulingModule,
  ],
})
export class PlatformModule {}
