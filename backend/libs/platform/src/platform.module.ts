import { Module } from '@nestjs/common';
import { PlatformConfigModule } from './config';
import { DatabaseModule } from './database';
import { ObservabilityModule } from './observability';
import { VideoQueueModule } from './queue';
import { RedisModule } from './redis';

@Module({
  imports: [
    PlatformConfigModule,
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    VideoQueueModule,
  ],
  exports: [
    PlatformConfigModule,
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    VideoQueueModule,
  ],
})
export class PlatformModule {}
