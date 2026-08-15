import { Module } from '@nestjs/common';
import { IdentityModule } from '@lms/identity';
import { LearningModule } from '@lms/learning';
import { OperationsModule } from '@lms/operations';
import {
  DatabaseModule,
  PlatformSchedulingModule,
  RedisModule,
  VideoQueueModule,
} from '@lms/platform';
import * as UseCases from './application';
import {
  MEDIA_PROBE,
  MEDIA_LEASE,
  MEDIA_REPOSITORY,
  OBJECT_STORAGE,
  TEMPORARY_WORKSPACE,
  PLAYBACK_LOCK,
  PLAYBACK_REPOSITORY,
  VIDEO_TRANSCODER,
} from './application';
import {
  FfmpegHlsAdapter,
  FfprobeAdapter,
  MediaCommandRunner,
  PrismaMediaRepository,
  PrismaPlaybackRepository,
  RedisPlaybackLockAdapter,
  Es256MediaLeaseAdapter,
  S3ObjectStorageAdapter,
  TemporaryWorkspaceAdapter,
} from './infrastructure';
import { UploadCleanupService } from './infrastructure/scheduling/upload-cleanup.service';
import { PlaybackCleanupService } from './infrastructure/scheduling/playback-cleanup.service';
import { PrismaContentDeletionService } from './infrastructure/deletion/prisma-content-deletion.service';
import {
  LessonResourceController,
  OwnerContentDeletionController,
  OwnerVideoController,
  PlaybackController,
} from './presentation';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    LearningModule,
    OperationsModule,
    VideoQueueModule,
    RedisModule,
    PlatformSchedulingModule,
  ],
  controllers: [
    OwnerVideoController,
    LessonResourceController,
    OwnerContentDeletionController,
    PlaybackController,
  ],
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
    UseCases.CreatePlaybackSessionUseCase,
    UseCases.HeartbeatPlaybackSessionUseCase,
    UseCases.EndPlaybackSessionUseCase,
    UseCases.IssueMediaLeaseUseCase,
    UseCases.ExpireStalePlaybackSessionsUseCase,
    UploadCleanupService,
    PlaybackCleanupService,
    PrismaContentDeletionService,
    MediaCommandRunner,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    { provide: PLAYBACK_REPOSITORY, useClass: PrismaPlaybackRepository },
    { provide: PLAYBACK_LOCK, useClass: RedisPlaybackLockAdapter },
    { provide: MEDIA_LEASE, useClass: Es256MediaLeaseAdapter },
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
