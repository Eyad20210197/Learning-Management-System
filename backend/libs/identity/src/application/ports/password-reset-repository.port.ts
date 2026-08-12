export type PasswordResetConsumeResult = 'consumed' | 'invalid';

export interface PasswordResetRepositoryPort {
  findUserIdByEmail(email: string): Promise<string | null>;
  replacePasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumePasswordResetToken(input: {
    tokenHash: string;
    newPasswordHash: string;
  }): Promise<PasswordResetConsumeResult>;
  getPasswordHash(userId: string): Promise<string | null>;
  changePassword(input: {
    userId: string;
    newPasswordHash: string;
    currentSessionId: string;
  }): Promise<void>;
}

export const PASSWORD_RESET_REPOSITORY = Symbol(
  'identity.password-reset-repository',
);
