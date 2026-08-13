import type {
  PlaybackSessionView,
  PlaybackSourceView,
  PlaybackStatus,
} from '../../domain';

export interface PlaybackRepositoryPort {
  findPlaybackSource(
    userId: string,
    lessonId: string,
  ): Promise<PlaybackSourceView | null>;
  createReplacingSession(input: {
    userId: string;
    lessonId: string;
    videoId: string;
    deviceId: string;
    authSessionId: string;
    sessionCode: string;
    lastPositionSeconds: number;
    ipAddress?: string;
    now: Date;
  }): Promise<PlaybackSessionView>;
  findOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<PlaybackSessionView | null>;
  findActiveSession(userId: string): Promise<PlaybackSessionView | null>;
  heartbeat(input: {
    userId: string;
    sessionId: string;
    deviceId: string;
    authSessionId: string;
    positionSeconds: number;
    now: Date;
  }): Promise<PlaybackSessionView | null>;
  end(userId: string, sessionId: string, now: Date): Promise<boolean>;
  transitionActive(
    sessionId: string,
    status: Extract<PlaybackStatus, 'EXPIRED' | 'REVOKED'>,
    now: Date,
  ): Promise<boolean>;
  expireStale(cutoff: Date, now: Date): Promise<string[]>;
}

export const PLAYBACK_REPOSITORY = Symbol('media.playback-repository');
