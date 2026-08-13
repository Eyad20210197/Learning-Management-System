import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type { PlaybackRepositoryPort } from '../../application';
import type {
  PlaybackSessionView,
  PlaybackSourceView,
  PlaybackStatus,
} from '../../domain';

@Injectable()
export class PrismaPlaybackRepository implements PlaybackRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findPlaybackSource(
    userId: string,
    lessonId: string,
  ): Promise<PlaybackSourceView | null> {
    const video = await this.prisma.video.findFirst({
      where: {
        lessonId,
        status: 'READY',
        isCurrent: true,
        assets: { some: { type: 'HLS_MASTER' } },
      },
      select: {
        id: true,
        lessonId: true,
        assets: {
          where: { type: 'HLS_MASTER' },
          select: { storageKey: true },
          take: 1,
        },
      },
    });
    if (
      video === null ||
      video.assets[0]?.storageKey !== `processed/${video.id}/hls/master.m3u8`
    )
      return null;
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { lastPositionSeconds: true },
    });
    return {
      videoId: video.id,
      lessonId: video.lessonId,
      resumePositionSeconds: progress?.lastPositionSeconds ?? 0,
    };
  }

  async createReplacingSession(input: {
    userId: string;
    lessonId: string;
    videoId: string;
    deviceId: string;
    authSessionId: string;
    sessionCode: string;
    lastPositionSeconds: number;
    ipAddress?: string;
    now: Date;
  }): Promise<PlaybackSessionView> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
        const replaced = await transaction.playbackSession.findMany({
          where: { userId: input.userId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (replaced.length > 0) {
          await transaction.playbackSession.updateMany({
            where: { id: { in: replaced.map(({ id }) => id) } },
            data: { status: 'REPLACED', endedAt: input.now },
          });
          await transaction.playbackEvent.createMany({
            data: replaced.map(({ id }) => ({
              playbackSessionId: id,
              eventType: 'REPLACED',
            })),
          });
        }
        const created = await transaction.playbackSession.create({
          data: {
            userId: input.userId,
            lessonId: input.lessonId,
            videoId: input.videoId,
            deviceId: input.deviceId,
            authSessionId: input.authSessionId,
            sessionCode: input.sessionCode,
            lastPositionSeconds: input.lastPositionSeconds,
            ipAddress: input.ipAddress,
            startedAt: input.now,
            lastHeartbeatAt: input.now,
            events: { create: { eventType: 'STARTED' } },
          },
        });
        return this.toView(created);
      },
      // The per-user advisory lock is the serialization boundary. Keeping the
      // transaction at READ COMMITTED ensures a waiter observes the winner's
      // committed session after it acquires the lock instead of retaining a
      // stale SERIALIZABLE snapshot and failing with Prisma P2034.
      { isolationLevel: 'ReadCommitted' },
    );
  }

  async findOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<PlaybackSessionView | null> {
    const record = await this.prisma.playbackSession.findFirst({
      where: { id: sessionId, userId },
    });
    return record === null ? null : this.toView(record);
  }

  async findActiveSession(userId: string): Promise<PlaybackSessionView | null> {
    const record = await this.prisma.playbackSession.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    return record === null ? null : this.toView(record);
  }

  async heartbeat(input: {
    userId: string;
    sessionId: string;
    deviceId: string;
    authSessionId: string;
    positionSeconds: number;
    now: Date;
  }): Promise<PlaybackSessionView | null> {
    const updated = await this.prisma.playbackSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        deviceId: input.deviceId,
        authSessionId: input.authSessionId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        device: { revokedAt: null },
        authSession: { revokedAt: null },
        lesson: {
          section: {
            course: {
              status: 'PUBLISHED',
              enrollments: {
                some: {
                  userId: input.userId,
                  status: 'ACTIVE',
                  startsAt: { lte: input.now },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
                },
              },
            },
          },
        },
      },
      data: {
        lastHeartbeatAt: input.now,
        lastPositionSeconds: input.positionSeconds,
      },
    });
    if (updated.count === 0) return null;
    return this.toView(
      await this.prisma.playbackSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      }),
    );
  }

  async end(userId: string, sessionId: string, now: Date): Promise<boolean> {
    return this.transition(userId, sessionId, 'ENDED', now);
  }

  async transitionActive(
    sessionId: string,
    status: Extract<PlaybackStatus, 'EXPIRED' | 'REVOKED'>,
    now: Date,
  ): Promise<boolean> {
    return this.transition(undefined, sessionId, status, now);
  }

  async expireStale(cutoff: Date, now: Date): Promise<string[]> {
    return this.prisma.$transaction(async (transaction) => {
      const stale = await transaction.playbackSession.findMany({
        where: { status: 'ACTIVE', lastHeartbeatAt: { lt: cutoff } },
        select: { id: true },
      });
      if (stale.length === 0) return [];
      const ids = stale.map(({ id }) => id);
      await transaction.playbackSession.updateMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        data: { status: 'EXPIRED', endedAt: now },
      });
      await transaction.playbackEvent.createMany({
        data: ids.map((id) => ({
          playbackSessionId: id,
          eventType: 'EXPIRED',
        })),
      });
      return ids;
    });
  }

  private async transition(
    userId: string | undefined,
    sessionId: string,
    status: Extract<PlaybackStatus, 'ENDED' | 'EXPIRED' | 'REVOKED'>,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.playbackSession.updateMany({
        where: {
          id: sessionId,
          ...(userId === undefined ? {} : { userId }),
          status: 'ACTIVE',
        },
        data: { status, endedAt: now },
      });
      if (updated.count === 0) return false;
      await transaction.playbackEvent.create({
        data: { playbackSessionId: sessionId, eventType: status },
      });
      return true;
    });
  }

  private toView(record: {
    id: string;
    userId: string;
    lessonId: string;
    videoId: string;
    deviceId: string;
    authSessionId: string;
    status: PlaybackStatus;
    sessionCode: string;
    startedAt: Date;
    lastHeartbeatAt: Date;
    endedAt: Date | null;
    lastPositionSeconds: number;
  }): PlaybackSessionView {
    return record;
  }
}
