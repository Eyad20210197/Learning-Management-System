import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
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
  CompleteLessonResourceUseCase,
  GetLessonResourceDownloadUseCase,
  InitiateLessonResourceUseCase,
} from '../../application';
import { LessonResourceUploadDto } from '../dto/video-upload.dto';

interface AuthenticatedRequest extends Request {
  auth: { user: { id: string } };
}

@Controller({ version: '1' })
export class LessonResourceController {
  constructor(
    private readonly initiateResource: InitiateLessonResourceUseCase,
    private readonly completeResource: CompleteLessonResourceUseCase,
    private readonly getDownload: GetLessonResourceDownloadUseCase,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  @Post('owner/lessons/:lessonId/resources')
  @UseGuards(AccessTokenGuard, PermissionGuard)
  @RequirePermissions('curriculum.create')
  async initiate(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: LessonResourceUploadDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: request.auth.user.id,
        scope: `lesson-resource.create:${lessonId}`,
        key,
        request: dto,
        responseStatus: 201,
        ttlSeconds: 900,
        handler: async () => {
          const resource = await this.initiateResource.execute({
            lessonId,
            actorUserId: request.auth.user.id,
            ...dto,
          });
          await this.audit.record({
            actorUserId: request.auth.user.id,
            action: 'lesson-resource.upload.initiate',
            targetType: 'lessonResource',
            targetId: resource.id,
          });
          return resource;
        },
      })
    ).value;
  }

  @Post('owner/lesson-resources/:resourceId/complete')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, PermissionGuard)
  @RequirePermissions('curriculum.update')
  async complete(
    @Req() request: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) id: string,
  ) {
    const resource = await this.completeResource.execute(id);
    await this.audit.record({
      actorUserId: request.auth.user.id,
      action: 'lesson-resource.upload.complete',
      targetType: 'lessonResource',
      targetId: id,
    });
    return {
      id: resource.id,
      lessonId: resource.lessonId,
      title: resource.title,
      filename: resource.filename,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes.toString(),
      createdAt: resource.createdAt.toISOString(),
    };
  }

  @Post('me/lesson-resources/:resourceId/download')
  @UseGuards(AccessTokenGuard)
  download(
    @Req() request: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) id: string,
  ) {
    return this.getDownload.execute(request.auth.user.id, id);
  }
}
