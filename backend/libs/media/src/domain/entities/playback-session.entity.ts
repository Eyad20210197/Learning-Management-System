export type PlaybackStatus =
  'ACTIVE' | 'ENDED' | 'EXPIRED' | 'REVOKED' | 'REPLACED';

export interface PlaybackSessionView {
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
}

export interface PlaybackSourceView {
  videoId: string;
  lessonId: string;
  resumePositionSeconds: number;
}

export const playbackHlsPath = (videoId: string): string =>
  `/media/hls/${videoId}/master.m3u8`;
