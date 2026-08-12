import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IdentityModule } from '@lms/identity';
import { OperationsModule } from '@lms/operations';
import { DatabaseModule, VideoQueueModule } from '@lms/platform';
import * as UseCases from './application';
import { MEDIA_REPOSITORY, OBJECT_STORAGE } from './application';
import {
  PrismaMediaRepository,
  S3ObjectStorageAdapter,
} from './infrastructure';
import { UploadCleanupService } from './infrastructure/scheduling/upload-cleanup.service';
import { LessonResourceController, OwnerVideoController } from './presentation';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    OperationsModule,
    VideoQueueModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [OwnerVideoController, LessonResourceController],
  providers: [
    UseCases.InitiateVideoUploadUseCase,
    UseCases.CompleteVideoUploadUseCase,
    UseCases.CreateMultipartPartUrlUseCase,
    UseCases.CompleteMultipartUploadUseCase,
    UseCases.GetVideoUseCase,
    UseCases.ExpireVideoUploadsUseCase,
    UseCases.InitiateLessonResourceUseCase,
    UseCases.CompleteLessonResourceUseCase,
    UseCases.GetLessonResourceDownloadUseCase,
    UseCases.ExpireLessonResourcesUseCase,
    UploadCleanupService,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorageAdapter },
  ],
  exports: [
    UseCases.GetVideoUseCase,
    UseCases.ExpireVideoUploadsUseCase,
    MEDIA_REPOSITORY,
    OBJECT_STORAGE,
  ],
})
export class MediaModule {}
