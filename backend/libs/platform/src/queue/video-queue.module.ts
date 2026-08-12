import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PlatformConfigModule } from '../config';
import { VIDEO_PROCESSING_QUEUE } from './video-queue.constants';

@Module({
  imports: [
    PlatformConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('redis.url'),
          maxRetriesPerRequest: null,
        },
        prefix: configService.getOrThrow<string>('queue.prefix'),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 604_800, count: 5_000 },
        },
      }),
    }),
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
  ],
  exports: [BullModule],
})
export class VideoQueueModule {}
