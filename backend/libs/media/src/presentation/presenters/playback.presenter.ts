import type {
  CreatedPlaybackSession,
  PlaybackResponse,
} from '../../application';

export interface PlaybackSessionResponse {
  id: string;
  lessonId: string;
  videoId: string;
  status: string;
  hlsUrl: string;
  sessionCode: string;
  lastPositionSeconds: number;
  heartbeatIntervalSeconds: number;
  leaseExpiresAt?: string;
}

export class PlaybackPresenter {
  static created(result: CreatedPlaybackSession): PlaybackSessionResponse {
    return this.present(result);
  }

  static heartbeat(result: PlaybackResponse): PlaybackSessionResponse {
    return {
      ...this.present(result),
      leaseExpiresAt: result.lease.expiresAt.toISOString(),
    };
  }

  private static present(
    result: Omit<PlaybackResponse, 'lease'>,
  ): PlaybackSessionResponse {
    return {
      id: result.session.id,
      lessonId: result.session.lessonId,
      videoId: result.session.videoId,
      status: result.session.status,
      hlsUrl: result.hlsUrl,
      sessionCode: result.session.sessionCode,
      lastPositionSeconds: result.session.lastPositionSeconds,
      heartbeatIntervalSeconds: result.heartbeatIntervalSeconds,
    };
  }
}
