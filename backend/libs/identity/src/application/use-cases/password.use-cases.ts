import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidCredentialsError,
  PasswordResetTokenInvalidError,
} from '../../domain';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import {
  PASSWORD_RESET_NOTIFIER,
  type PasswordResetNotifierPort,
} from '../ports/password-reset-notifier.port';
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordResetRepositoryPort,
} from '../ports/password-reset-repository.port';
import {
  TOKEN_SERVICE,
  type TokenServicePort,
} from '../ports/token-service.port';

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwords: PasswordResetRepositoryPort,
    @Inject(PASSWORD_RESET_NOTIFIER)
    private readonly notifier: PasswordResetNotifierPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly config: ConfigService,
  ) {}

  async execute(emailInput: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    const userId = await this.passwords.findUserIdByEmail(email);
    if (userId === null) return;

    const token = this.tokens.issueRefreshToken();
    const ttl = this.config.getOrThrow<number>('app.passwordResetTtlSeconds');
    await this.passwords.replacePasswordResetToken({
      userId,
      tokenHash: this.tokens.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + ttl * 1000),
    });
    await this.notifier.sendPasswordReset(email, token);
  }
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwords: PasswordResetRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const newPasswordHash = await this.hasher.hash(newPassword);
    const result = await this.passwords.consumePasswordResetToken({
      tokenHash: this.tokens.hashRefreshToken(token),
      newPasswordHash,
    });
    if (result === 'invalid') throw new PasswordResetTokenInvalidError();
  }
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwords: PasswordResetRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: {
    userId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const currentHash = await this.passwords.getPasswordHash(input.userId);
    if (
      currentHash === null ||
      !(await this.hasher.verify(currentHash, input.currentPassword))
    ) {
      throw new InvalidCredentialsError();
    }
    const newPasswordHash = await this.hasher.hash(input.newPassword);
    await this.passwords.changePassword({
      userId: input.userId,
      currentSessionId: input.currentSessionId,
      newPasswordHash,
    });
  }
}
