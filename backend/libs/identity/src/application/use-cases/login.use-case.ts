import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountNotActiveError,
  InvalidCredentialsError,
  type Device,
  type User,
} from '../../domain';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
  type DeviceDescriptor,
  type RequestMetadata,
} from '../ports/auth-session-repository.port';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import {
  TOKEN_SERVICE,
  type TokenServicePort,
} from '../ports/token-service.port';

export interface LoginCommand extends RequestMetadata {
  email: string;
  password: string;
  device: DeviceDescriptor;
}

export interface LoginResult {
  user: User;
  device: Device;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly config: ConfigService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const identity = await this.sessions.findLoginIdentity(
      command.email.trim().toLowerCase(),
    );
    if (
      identity === null ||
      !(await this.passwordHasher.verify(
        identity.passwordHash,
        command.password,
      ))
    ) {
      throw new InvalidCredentialsError();
    }
    if (identity.user.status !== 'ACTIVE') throw new AccountNotActiveError();

    const refreshToken = this.tokens.issueRefreshToken();
    const session = await this.sessions.createSession({
      userId: identity.user.id,
      device: command.device,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt: this.tokens.refreshTokenExpiresAt(),
      maxRegisteredDevices: this.config.getOrThrow<number>(
        'app.maxRegisteredDevices',
      ),
      metadata: command,
    });
    const access = await this.tokens.issueAccessToken({
      userId: session.user.id,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      roles: session.user.roles,
      permissions: session.permissions,
    });

    return {
      user: session.user,
      device: session.device,
      accessToken: access.value,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken,
    };
  }
}
