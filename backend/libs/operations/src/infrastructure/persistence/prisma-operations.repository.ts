import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  AuditLogView,
  CursorPage,
  OperationsSummaryView,
  SecurityEventView,
  StudentSupportView,
  VideoOperationView,
} from '../../domain';
import { InvalidCursorError } from '../../domain';
import type {
  OperationsRepositoryPort,
  PageQuery,
  SecuritySeverityFilter,
  VideoOperationStatus,
} from '../../application';

interface CursorBoundary {
  id: string;
  createdAt: Date;
}

@Injectable()
export class PrismaOperationsRepository implements OperationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentSupport(
    studentId: string,
  ): Promise<StudentSupportView | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: studentId,
        roles: { some: { role: { name: 'STUDENT' } } },
      },
      include: {
        devices: { orderBy: { lastSeenAt: 'desc' } },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        enrollments: {
          include: { course: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
        },
        playbackSessions: {
          include: { lesson: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (user === null) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      devices: user.devices.map((device) => ({
        id: device.id,
        clientDeviceId: device.clientDeviceUuid,
        name: device.name,
        browser: device.browser,
        operatingSystem: device.operatingSystem,
        firstSeenAt: device.firstSeenAt,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt,
      })),
      authSessions: user.sessions.map((session) => ({
        id: session.id,
        deviceId: session.deviceId,
        lastSeenAt: session.lastSeenAt,
        revokedAt: session.revokedAt,
        revokeReason: session.revokeReason,
        createdAt: session.createdAt,
      })),
      enrollments: user.enrollments.map((enrollment) => ({
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        status: enrollment.status,
        startsAt: enrollment.startsAt,
        expiresAt: enrollment.expiresAt,
        completedAt: enrollment.completedAt,
        createdAt: enrollment.createdAt,
      })),
      playbackSessions: user.playbackSessions.map((session) => ({
        id: session.id,
        lessonId: session.lessonId,
        lessonTitle: session.lesson.title,
        videoId: session.videoId,
        deviceId: session.deviceId,
        status: session.status,
        lastHeartbeatAt: session.lastHeartbeatAt,
        endedAt: session.endedAt,
        lastPositionSeconds: session.lastPositionSeconds,
        createdAt: session.createdAt,
      })),
    };
  }

  async listVideoOperations(
    query: PageQuery & { status?: VideoOperationStatus },
  ): Promise<CursorPage<VideoOperationView>> {
    const boundary = await this.videoBoundary(query.cursor);
    const records = await this.prisma.video.findMany({
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...this.after(boundary),
      },
      include: {
        lesson: {
          select: {
            title: true,
            section: {
              select: {
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
        uploads: { orderBy: { createdAt: 'desc' } },
        processingJobs: { orderBy: { createdAt: 'desc' } },
        variants: { orderBy: { height: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map((video) => ({
      id: video.id,
      lessonId: video.lessonId,
      lessonTitle: video.lesson.title,
      courseId: video.lesson.section.course.id,
      courseTitle: video.lesson.section.course.title,
      status: video.status,
      sourceFilename: video.sourceFilename,
      sourceSizeBytes: video.sourceSizeBytes.toString(),
      durationSeconds: video.durationSeconds,
      width: video.width,
      height: video.height,
      isCurrent: video.isCurrent,
      processingError: video.processingError,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      uploads: video.uploads.map((upload) => ({
        id: upload.id,
        status: upload.status,
        expectedSizeBytes: upload.expectedSizeBytes.toString(),
        completedAt: upload.completedAt,
        expiresAt: upload.expiresAt,
        createdAt: upload.createdAt,
      })),
      processingJobs: video.processingJobs.map((job) => ({
        id: job.id,
        status: job.status,
        attempt: job.attempt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
      })),
      variants: video.variants.map((variant) => ({
        id: variant.id,
        status: variant.status,
        width: variant.width,
        height: variant.height,
        bitrateKbps: variant.bitrateKbps,
        sizeBytes: variant.sizeBytes?.toString() ?? null,
      })),
    }));
    return this.page(items, hasMore);
  }

  async listAuditLogs(
    query: PageQuery & {
      action?: string;
      actorUserId?: string;
      targetType?: string;
    },
  ): Promise<CursorPage<AuditLogView>> {
    const boundary = await this.auditBoundary(query.cursor);
    const records = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action === undefined ? {} : { action: query.action }),
        ...(query.actorUserId === undefined
          ? {}
          : { actorUserId: query.actorUserId }),
        ...(query.targetType === undefined
          ? {}
          : { targetType: query.targetType }),
        ...this.after(boundary),
      },
      include: { actor: { select: { email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = records.length > query.limit;
    return this.page(
      records.slice(0, query.limit).map((record) => ({
        id: record.id,
        actorUserId: record.actorUserId,
        actorEmail: record.actor?.email ?? null,
        action: record.action,
        targetType: record.targetType,
        targetId: record.targetId,
        requestId: record.requestId,
        metadata: record.metadata,
        createdAt: record.createdAt,
      })),
      hasMore,
    );
  }

  async listSecurityEvents(
    query: PageQuery & {
      severity?: SecuritySeverityFilter;
      unresolvedOnly?: boolean;
    },
  ): Promise<CursorPage<SecurityEventView>> {
    const boundary = await this.securityBoundary(query.cursor);
    const records = await this.prisma.securityEvent.findMany({
      where: {
        ...(query.severity === undefined ? {} : { severity: query.severity }),
        ...(query.unresolvedOnly === true ? { resolvedAt: null } : {}),
        ...this.after(boundary),
      },
      include: { user: { select: { email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = records.length > query.limit;
    return this.page(
      records.slice(0, query.limit).map((record) => ({
        id: record.id,
        userId: record.userId,
        userEmail: record.user?.email ?? null,
        deviceId: record.deviceId,
        type: record.type,
        severity: record.severity,
        metadata: record.metadata,
        resolvedAt: record.resolvedAt,
        createdAt: record.createdAt,
      })),
      hasMore,
    );
  }

  async getSummary(now: Date): Promise<OperationsSummaryView> {
    const [
      students,
      activeEnrollments,
      publishedCourses,
      videosProcessing,
      videosFailed,
      activePlaybackSessions,
      unresolvedSecurityEvents,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { roles: { some: { role: { name: 'STUDENT' } } } },
      }),
      this.prisma.enrollment.count({
        where: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.video.count({
        where: { status: { in: ['UPLOADED', 'QUEUED', 'PROCESSING'] } },
      }),
      this.prisma.video.count({ where: { status: 'FAILED' } }),
      this.prisma.playbackSession.count({ where: { status: 'ACTIVE' } }),
      this.prisma.securityEvent.count({ where: { resolvedAt: null } }),
    ]);
    return {
      students,
      activeEnrollments,
      publishedCourses,
      videosProcessing,
      videosFailed,
      activePlaybackSessions,
      unresolvedSecurityEvents,
      generatedAt: now,
    };
  }

  async deleteExpiredIdempotencyKeys(now: Date): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }

  private after(boundary: CursorBoundary | null) {
    return boundary === null
      ? {}
      : {
          OR: [
            { createdAt: { lt: boundary.createdAt } },
            { createdAt: boundary.createdAt, id: { lt: boundary.id } },
          ],
        };
  }

  private page<T extends { id: string }>(
    items: T[],
    hasMore: boolean,
  ): CursorPage<T> {
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private async videoBoundary(cursor?: string): Promise<CursorBoundary | null> {
    if (cursor === undefined) return null;
    return this.requireBoundary(
      await this.prisma.video.findUnique({
        where: { id: cursor },
        select: { id: true, createdAt: true },
      }),
    );
  }

  private async auditBoundary(cursor?: string): Promise<CursorBoundary | null> {
    if (cursor === undefined) return null;
    return this.requireBoundary(
      await this.prisma.auditLog.findUnique({
        where: { id: cursor },
        select: { id: true, createdAt: true },
      }),
    );
  }

  private async securityBoundary(
    cursor?: string,
  ): Promise<CursorBoundary | null> {
    if (cursor === undefined) return null;
    return this.requireBoundary(
      await this.prisma.securityEvent.findUnique({
        where: { id: cursor },
        select: { id: true, createdAt: true },
      }),
    );
  }

  private requireBoundary(boundary: CursorBoundary | null): CursorBoundary {
    if (boundary === null) throw new InvalidCursorError();
    return boundary;
  }
}
