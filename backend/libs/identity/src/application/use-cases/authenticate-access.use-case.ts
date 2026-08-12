import { Inject, Injectable } from '@nestjs/common';
import { AccessTokenInvalidError } from '../../domain';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
  type SessionPrincipal,
} from '../ports/auth-session-repository.port';
import {
  TOKEN_SERVICE,
  type TokenServicePort,
} from '../ports/token-service.port';

@Injectable()
export class AuthenticateAccessUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(token: string): Promise<SessionPrincipal> {
    const claims = await this.tokens.verifyAccessToken(token);
    const principal = await this.sessions.findActivePrincipal({
      userId: claims.userId,
      sessionId: claims.sessionId,
      deviceId: claims.deviceId,
    });
    if (principal === null) throw new AccessTokenInvalidError();
    return principal;
  }
}
