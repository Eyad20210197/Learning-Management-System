export interface AccessTokenSubject {
  userId: string;
  sessionId: string;
  deviceId: string;
  roles: readonly string[];
  permissions: readonly string[];
}

export interface IssuedAccessToken {
  value: string;
  expiresInSeconds: number;
}

export interface TokenServicePort {
  issueAccessToken(subject: AccessTokenSubject): Promise<IssuedAccessToken>;
  verifyAccessToken(token: string): Promise<AccessTokenSubject>;
  issueRefreshToken(): string;
  hashRefreshToken(token: string): string;
  refreshTokenExpiresAt(): Date;
}

export const TOKEN_SERVICE = Symbol('identity.token-service');
