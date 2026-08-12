import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenGuard,
  PermissionGuard,
  RequirePermissions,
} from '@lms/identity';
import { AuditService, IdempotencyService } from '@lms/operations';
import type { Request } from 'express';
import {
  CompleteMultipartUploadUseCase,
  CompleteVideoUploadUseCase,
  CreateMultipartPartUrlUseCase,
  GetVideoUseCase,
  InitiateVideoUploadUseCase,
} from '../../application';
import {
  CompleteMultipartUploadDto,
  VideoUploadDto,
} from '../dto/video-upload.dto';
import { VideoPresenter } from '../presenters/video.presenter';

interface OwnerRequest extends Request {
  auth: { user: { id: string } };
}

@Controller({ path: 'owner', version: '1' })
@UseGuards(AccessTokenGuard, PermissionGuard)
export class OwnerVideoController {
  constructor(
    private readonly initiateUpload: InitiateVideoUploadUseCase,
    private readonly completeUpload: CompleteVideoUploadUseCase,
    private readonly createPartUrl: CreateMultipartPartUrlUseCase,
    private readonly completeMultipart: CompleteMultipartUploadUseCase,
    private readonly getVideo: GetVideoUseCase,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  @Post('video-uploads/:uploadId/parts/:partNumber')
  @RequirePermissions('video.upload')
  async part(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
  ) {
    return this.createPartUrl.execute(uploadId, partNumber);
  }

  @Post('video-uploads/:uploadId/multipart-complete')
  @HttpCode(202)
  @RequirePermissions('video.upload')
  async multipartComplete(
    @Req() request: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Body() dto: CompleteMultipartUploadDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: request.auth.user.id,
        scope: `video-upload.multipart-complete:${uploadId}`,
        key,
        request: dto,
        responseStatus: 202,
        handler: async () =>
          VideoPresenter.video(
            await this.completeMultipart.execute(uploadId, dto.parts),
          ),
      })
    ).value;
  }

  @Post('lessons/:lessonId/video-uploads')
  @RequirePermissions('video.upload')
  async initiate(
    @Req() request: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: VideoUploadDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: request.auth.user.id,
        scope: `video-upload.initiate:${lessonId}`,
        key,
        request: dto,
        responseStatus: 201,
        ttlSeconds: 900,
        handler: async () => {
          const upload = await this.initiateUpload.execute({
            lessonId,
            actorUserId: request.auth.user.id,
            ...dto,
          });
          await this.record(
            request,
            'video.upload.initiate',
            'video',
            upload.videoId,
          );
          return { ...upload, expiresAt: upload.expiresAt.toISOString() };
        },
      })
    ).value;
  }

  @Post('video-uploads/:uploadId/complete')
  @HttpCode(202)
  @RequirePermissions('video.upload')
  async complete(
    @Req() request: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: request.auth.user.id,
        scope: `video-upload.complete:${uploadId}`,
        key,
        request: { uploadId },
        responseStatus: 202,
        handler: async () => {
          const video = await this.completeUpload.execute(uploadId);
          await this.record(
            request,
            'video.upload.complete',
            'video',
            video.id,
          );
          return VideoPresenter.video(video);
        },
      })
    ).value;
  }

  @Get('videos/:videoId')
  @RequirePermissions('video.read')
  async get(@Param('videoId', ParseUUIDPipe) videoId: string) {
    return VideoPresenter.video(await this.getVideo.execute(videoId));
  }

  private record(
    request: OwnerRequest,
    action: string,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    return this.audit.record({
      actorUserId: request.auth.user.id,
      action,
      targetType,
      targetId,
      requestId: typeof request.id === 'string' ? request.id : undefined,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
