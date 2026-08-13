import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { SessionPrincipal } from '@lms/identity';
import {
  CourseAccessService,
  LEARNING_REPOSITORY,
  type LearningRepositoryPort,
} from '@lms/learning';
import type {
  ActivePlaybackState,
  PlaybackLockPort,
} from '../ports/playback-lock.port';
import type { PlaybackRepositoryPort } from '../ports/playback-repository.port';
import type {
  IssuedMediaLease,
  MediaLeasePort,
} from '../ports/media-lease.port';
import { PLAYBACK_LOCK } from '../ports/playback-lock.port';
import { PLAYBACK_REPOSITORY } from '../ports/playback-repository.port';
import { MEDIA_LEASE } from '../ports/media-lease.port';
import type { PlaybackSessionView } from '../../domain';
import {
  playbackHlsPath,
  PlaybackEndedError,
  PlaybackReplacedError,
  PlaybackRevokedError,
  PlaybackSessionNotFoundError,
  PlaybackUnavailableError,
} from '../../domain';

export interface PlaybackResponse {
  session: PlaybackSessionView;
  hlsUrl: string;
  heartbeatIntervalSeconds: number;
  lease: IssuedMediaLease;
}

export interface CreatedPlaybackSession {
  session: PlaybackSessionView;
  hlsUrl: string;
  heartbeatIntervalSeconds: number;
}

@Injectable()
export class CreatePlaybackSessionUseCase {
  constructor(
    @Inject(PLAYBACK_REPOSITORY)
    private readonly sessions: PlaybackRepositoryPort,
    @Inject(PLAYBACK_LOCK) private readonly lock: PlaybackLockPort,
    @Inject(LEARNING_REPOSITORY)
    private readonly learning: LearningRepositoryPort,
    private readonly courseAccess: CourseAccessService,
    private readonly config: ConfigService,
  ) {}

  async execute(input: {
    principal: SessionPrincipal;
    lessonId: string;
    ipAddress?: string;
  }): Promise<CreatedPlaybackSession> {
    const now = new Date();
    this.courseAccess.assertAccess(
      await this.learning.getEnrollmentForLesson(
        input.principal.user.id,
        input.lessonId,
      ),
      now,
    );
    const source = await this.sessions.findPlaybackSource(
      input.principal.user.id,
      input.lessonId,
    );
    if (source === null) throw new PlaybackUnavailableError();
    const session = await this.sessions.createReplacingSession({
      userId: input.principal.user.id,
      lessonId: source.lessonId,
      videoId: source.videoId,
      deviceId: input.principal.deviceId,
      authSessionId: input.principal.sessionId,
      sessionCode: randomBytes(6).toString('base64url').toUpperCase(),
      lastPositionSeconds: source.resumePositionSeconds,
      ipAddress: input.ipAddress,
      now,
    });
    try {
      await this.lock.replace(input.principal.user.id, this.state(session));
    } catch (error: unknown) {
      await this.sessions.transitionActive(session.id, 'REVOKED', new Date());
      throw error;
    }
    const confirmed = await this.sessions.findOwnedSession(
      input.principal.user.id,
      session.id,
    );
    if (confirmed?.status !== 'ACTIVE') {
      await this.lock.release(input.principal.user.id, session.id);
      const current = await this.sessions.findActiveSession(
        input.principal.user.id,
      );
      if (current !== null) {
        await this.lock.replace(current.userId, this.state(current));
      }
      throw new PlaybackReplacedError();
    }
    return {
      session: confirmed,
      hlsUrl: playbackHlsPath(confirmed.videoId),
      heartbeatIntervalSeconds: this.config.getOrThrow<number>(
        'playback.heartbeatIntervalSeconds',
      ),
    };
  }

  private state(session: PlaybackSessionView): ActivePlaybackState {
    return {
      sessionId: session.id,
      videoId: session.videoId,
      deviceId: session.deviceId,
      authSessionId: session.authSessionId,
    };
  }
}

@Injectable()
export class IssueMediaLeaseUseCase {
  constructor(
    @Inject(MEDIA_LEASE) private readonly leases: MediaLeasePort,
    @Inject(PLAYBACK_REPOSITORY)
    private readonly sessions: PlaybackRepositoryPort,
    @Inject(PLAYBACK_LOCK) private readonly lock: PlaybackLockPort,
  ) {}

  async execute(
    principal: SessionPrincipal,
    sessionId: string,
  ): Promise<IssuedMediaLease> {
    const session = await this.sessions.findOwnedSession(
      principal.user.id,
      sessionId,
    );
    if (session === null) throw new PlaybackSessionNotFoundError();
    const state = {
      sessionId: session.id,
      videoId: session.videoId,
      deviceId: session.deviceId,
      authSessionId: session.authSessionId,
    };
    if (
      session.status !== 'ACTIVE' ||
      session.deviceId !== principal.deviceId ||
      session.authSessionId !== principal.sessionId ||
      !(await this.lock.isCurrent(session.userId, state))
    ) {
      if (session.status === 'REPLACED') throw new PlaybackReplacedError();
      throw new PlaybackRevokedError();
    }
    return this.leases.issue({
      sessionId: session.id,
      userId: session.userId,
      deviceId: session.deviceId,
      videoId: session.videoId,
    });
  }
}

@Injectable()
export class HeartbeatPlaybackSessionUseCase {
  constructor(
    @Inject(PLAYBACK_REPOSITORY)
    private readonly sessions: PlaybackRepositoryPort,
    @Inject(PLAYBACK_LOCK) private readonly lock: PlaybackLockPort,
    @Inject(MEDIA_LEASE) private readonly leases: MediaLeasePort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: {
    principal: SessionPrincipal;
    sessionId: string;
    positionSeconds: number;
  }): Promise<PlaybackResponse> {
    const session = await this.sessions.findOwnedSession(
      input.principal.user.id,
      input.sessionId,
    );
    if (session === null) throw new PlaybackSessionNotFoundError();
    this.assertActive(session);
    const state = this.state(session);
    if (!(await this.lock.isCurrent(session.userId, state))) {
      await this.sessions.transitionActive(session.id, 'REVOKED', new Date());
      throw new PlaybackRevokedError();
    }
    const updated = await this.sessions.heartbeat({
      userId: input.principal.user.id,
      sessionId: input.sessionId,
      deviceId: input.principal.deviceId,
      authSessionId: input.principal.sessionId,
      positionSeconds: input.positionSeconds,
      now: new Date(),
    });
    if (updated === null) {
      await this.sessions.transitionActive(session.id, 'REVOKED', new Date());
      await this.lock.release(session.userId, session.id);
      throw new PlaybackRevokedError();
    }
    if (!(await this.lock.renew(updated.userId, this.state(updated)))) {
      throw new PlaybackRevokedError();
    }
    return {
      session: updated,
      hlsUrl: playbackHlsPath(updated.videoId),
      heartbeatIntervalSeconds: this.config.getOrThrow<number>(
        'playback.heartbeatIntervalSeconds',
      ),
      lease: await this.leases.issue({
        sessionId: updated.id,
        userId: updated.userId,
        deviceId: updated.deviceId,
        videoId: updated.videoId,
      }),
    };
  }

  private assertActive(session: PlaybackSessionView): void {
    if (session.status === 'REPLACED') throw new PlaybackReplacedError();
    if (session.status === 'REVOKED' || session.status === 'EXPIRED')
      throw new PlaybackRevokedError();
    if (session.status === 'ENDED') throw new PlaybackEndedError();
  }

  private state(session: PlaybackSessionView): ActivePlaybackState {
    return {
      sessionId: session.id,
      videoId: session.videoId,
      deviceId: session.deviceId,
      authSessionId: session.authSessionId,
    };
  }
}

@Injectable()
export class EndPlaybackSessionUseCase {
  constructor(
    @Inject(PLAYBACK_REPOSITORY)
    private readonly sessions: PlaybackRepositoryPort,
    @Inject(PLAYBACK_LOCK) private readonly lock: PlaybackLockPort,
  ) {}

  async execute(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findOwnedSession(userId, sessionId);
    if (session === null) throw new PlaybackSessionNotFoundError();
    if (session.status === 'ACTIVE') {
      await this.sessions.end(userId, sessionId, new Date());
    }
    await this.lock.release(userId, sessionId);
  }
}

@Injectable()
export class ExpireStalePlaybackSessionsUseCase {
  constructor(
    @Inject(PLAYBACK_REPOSITORY)
    private readonly sessions: PlaybackRepositoryPort,
    @Inject(PLAYBACK_LOCK) private readonly lock: PlaybackLockPort,
    private readonly config: ConfigService,
  ) {}

  async execute(now = new Date()): Promise<number> {
    const staleAfter = this.config.getOrThrow<number>(
      'playback.staleAfterSeconds',
    );
    const ids = await this.sessions.expireStale(
      new Date(now.getTime() - staleAfter * 1000),
      now,
    );
    await Promise.all(ids.map((id) => this.lock.removeSession(id)));
    return ids.length;
  }
}
