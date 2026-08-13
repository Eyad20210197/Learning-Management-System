import { Injectable } from '@nestjs/common';
import type {
  AuditLogView,
  CursorPage,
  OperationsSummaryView,
  SecurityEventView,
  StudentSupportView,
  VideoOperationView,
} from '../../domain';
import { SensitiveMetadataSanitizer } from '../../application';

@Injectable()
export class OperationsPresenter {
  constructor(private readonly sanitizer: SensitiveMetadataSanitizer) {}

  student(view: StudentSupportView): Record<string, unknown> {
    return {
      user: {
        ...view.user,
        lastLoginAt: view.user.lastLoginAt?.toISOString() ?? null,
        createdAt: view.user.createdAt.toISOString(),
      },
      devices: view.devices.map((device) => ({
        ...device,
        firstSeenAt: device.firstSeenAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
        revokedAt: device.revokedAt?.toISOString() ?? null,
      })),
      authSessions: view.authSessions.map((session) => ({
        ...session,
        lastSeenAt: session.lastSeenAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
      })),
      enrollments: view.enrollments.map((enrollment) => ({
        ...enrollment,
        startsAt: enrollment.startsAt.toISOString(),
        expiresAt: enrollment.expiresAt?.toISOString() ?? null,
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        createdAt: enrollment.createdAt.toISOString(),
      })),
      playbackSessions: view.playbackSessions.map((session) => ({
        ...session,
        lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
      })),
    };
  }

  videos(page: CursorPage<VideoOperationView>): Record<string, unknown> {
    return {
      items: page.items.map((video) => ({
        ...video,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        uploads: video.uploads.map((upload) => ({
          ...upload,
          completedAt: upload.completedAt?.toISOString() ?? null,
          expiresAt: upload.expiresAt.toISOString(),
          createdAt: upload.createdAt.toISOString(),
        })),
        processingJobs: video.processingJobs.map((job) => ({
          ...job,
          startedAt: job.startedAt?.toISOString() ?? null,
          finishedAt: job.finishedAt?.toISOString() ?? null,
          createdAt: job.createdAt.toISOString(),
        })),
      })),
      nextCursor: page.nextCursor,
    };
  }

  audits(page: CursorPage<AuditLogView>): Record<string, unknown> {
    return {
      items: page.items.map((entry) => ({
        ...entry,
        metadata: this.sanitizer.sanitize(entry.metadata),
        createdAt: entry.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  security(page: CursorPage<SecurityEventView>): Record<string, unknown> {
    return {
      items: page.items.map((entry) => ({
        ...entry,
        metadata: this.sanitizer.sanitize(entry.metadata),
        resolvedAt: entry.resolvedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  summary(view: OperationsSummaryView): Record<string, unknown> {
    return { ...view, generatedAt: view.generatedAt.toISOString() };
  }
}
