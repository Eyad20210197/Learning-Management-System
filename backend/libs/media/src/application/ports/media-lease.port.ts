export interface MediaLeaseClaims {
  sessionId: string;
  userId: string;
  deviceId: string;
  videoId: string;
  audience: 'lms-media';
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
}

export interface IssuedMediaLease {
  token: string;
  expiresAt: Date;
}

export interface MediaLeasePort {
  issue(input: {
    sessionId: string;
    userId: string;
    deviceId: string;
    videoId: string;
  }): Promise<IssuedMediaLease>;
}

export const MEDIA_LEASE = Symbol('media.media-lease');
