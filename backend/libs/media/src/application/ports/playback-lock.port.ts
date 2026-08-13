export interface ActivePlaybackState {
  sessionId: string;
  videoId: string;
  deviceId: string;
  authSessionId: string;
}

export interface PlaybackLockPort {
  replace(userId: string, state: ActivePlaybackState): Promise<string | null>;
  isCurrent(userId: string, state: ActivePlaybackState): Promise<boolean>;
  renew(userId: string, state: ActivePlaybackState): Promise<boolean>;
  release(userId: string, sessionId: string): Promise<void>;
  removeSession(sessionId: string): Promise<void>;
}

export const PLAYBACK_LOCK = Symbol('media.playback-lock');
