import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IdentityModule } from '@lms/identity';
import { OperationsModule } from '@lms/operations';
import { DatabaseModule, VideoQueueModule } from '@lms/platform';
import * as UseCases from './application';
import {
  MEDIA_PROBE,
  MEDIA_REPOSITORY,
  OBJECT_STORAGE,
  TEMPORARY_WORKSPACE,
  VIDEO_TRANSCODER,
} from './application';
import {
  FfmpegHlsAdapter,
  FfprobeAdapter,
  MediaCommandRunner,
  PrismaMediaRepository,
  S3ObjectStorageAdapter,
  TemporaryWorkspaceAdapter,
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
    UseCases.GetVideoDetailsUseCase,
    UseCases.RetryVideoProcessingUseCase,
    UseCases.ActivateVideoUseCase,
    UseCases.ProcessVideoUseCase,
    UseCases.ExpireVideoUploadsUseCase,
    UseCases.InitiateLessonResourceUseCase,
    UseCases.CompleteLessonResourceUseCase,
    UseCases.GetLessonResourceDownloadUseCase,
    UseCases.ExpireLessonResourcesUseCase,
    UploadCleanupService,
    MediaCommandRunner,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorageAdapter },
    { provide: TEMPORARY_WORKSPACE, useClass: TemporaryWorkspaceAdapter },
    { provide: MEDIA_PROBE, useClass: FfprobeAdapter },
    { provide: VIDEO_TRANSCODER, useClass: FfmpegHlsAdapter },
  ],
  exports: [
    UseCases.GetVideoUseCase,
    UseCases.GetVideoDetailsUseCase,
    UseCases.RetryVideoProcessingUseCase,
    UseCases.ActivateVideoUseCase,
    UseCases.ProcessVideoUseCase,
    UseCases.ExpireVideoUploadsUseCase,
    MEDIA_REPOSITORY,
    OBJECT_STORAGE,
  ],
})
export class MediaModule {}
