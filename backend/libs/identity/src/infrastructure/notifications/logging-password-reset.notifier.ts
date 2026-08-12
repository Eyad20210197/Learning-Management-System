import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PasswordResetNotifierPort } from '../../application';

@Injectable()
export class LoggingPasswordResetNotifier implements PasswordResetNotifierPort {
  private readonly logger = new Logger(LoggingPasswordResetNotifier.name);

  constructor(private readonly config: ConfigService) {}

  sendPasswordReset(email: string, token: string): Promise<void> {
    const environment = this.config.getOrThrow<string>('app.nodeEnv');
    if (environment === 'production') {
      throw new Error(
        'A production password-reset notification adapter must be configured.',
      );
    }
    this.logger.warn(
      `Development password reset for ${email}: token=${token}. Never enable this adapter in production.`,
    );
    return Promise.resolve();
  }
}
