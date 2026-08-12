import { Inject, Injectable } from '@nestjs/common';
import {
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
} from '../../domain';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
  type RequestMetadata,
} from '../ports/auth-session-repository.port';
import {
  TOKEN_SERVICE,
  type TokenServicePort,
} from '../ports/token-service.port';

export interface RefreshResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(
    presentedToken: string | undefined,
    metadata: RequestMetadata,
  ): Promise<RefreshResult> {
    if (presentedToken === undefined || presentedToken.length < 32)
      throw new RefreshTokenInvalidError();
    const replacement = this.tokens.issueRefreshToken();
    const rotation = await this.sessions.rotateRefreshToken({
      presentedTokenHash: this.tokens.hashRefreshToken(presentedToken),
      replacementTokenHash: this.tokens.hashRefreshToken(replacement),
      replacementExpiresAt: this.tokens.refreshTokenExpiresAt(),
      metadata,
    });
    if (rotation.kind === 'invalid') throw new RefreshTokenInvalidError();
    if (rotation.kind === 'reused') throw new RefreshTokenReusedError();

    const access = await this.tokens.issueAccessToken({
      userId: rotation.principal.user.id,
      sessionId: rotation.principal.sessionId,
      deviceId: rotation.principal.deviceId,
      roles: rotation.principal.user.roles,
      permissions: rotation.principal.permissions,
    });
    return {
      accessToken: access.value,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: replacement,
    };
  }
}
