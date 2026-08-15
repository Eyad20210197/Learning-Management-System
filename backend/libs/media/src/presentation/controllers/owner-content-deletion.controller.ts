import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenGuard,
  PermissionGuard,
  RequirePermissions,
} from '@lms/identity';
import { AuditService } from '@lms/operations';
import type { Request } from 'express';
import { PrismaContentDeletionService } from '../../infrastructure/deletion/prisma-content-deletion.service';

interface OwnerRequest extends Request {
  auth: { user: { id: string } };
}

@Controller({ path: 'owner', version: '1' })
@UseGuards(AccessTokenGuard, PermissionGuard)
export class OwnerContentDeletionController {
  constructor(
    private readonly deletion: PrismaContentDeletionService,
    private readonly audit: AuditService,
  ) {}

  @Get('lesson-resources')
  @RequirePermissions('video.read')
  async resources() {
    return { items: await this.deletion.listResources(), nextCursor: null };
  }

  @Delete('lesson-resources/:resourceId')
  @HttpCode(204)
  @RequirePermissions('curriculum.update')
  async deleteResource(
    @Req() request: OwnerRequest,
    @Param('resourceId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deletion.deleteResource(id);
    await this.record(request, 'lesson-resource.delete', 'lessonResource', id);
  }

  @Delete('videos/:videoId')
  @HttpCode(204)
  @RequirePermissions('curriculum.update')
  async deleteVideo(
    @Req() request: OwnerRequest,
    @Param('videoId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deletion.deleteVideo(id);
    await this.record(request, 'video.delete', 'video', id);
  }

  @Delete('lessons/:lessonId')
  @HttpCode(204)
  @RequirePermissions('curriculum.update')
  async deleteLesson(
    @Req() request: OwnerRequest,
    @Param('lessonId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deletion.deleteLesson(id);
    await this.record(request, 'lesson.delete', 'lesson', id);
  }

  @Delete('sections/:sectionId')
  @HttpCode(204)
  @RequirePermissions('curriculum.update')
  async deleteSection(
    @Req() request: OwnerRequest,
    @Param('sectionId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deletion.deleteSection(id);
    await this.record(request, 'section.delete', 'courseSection', id);
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
