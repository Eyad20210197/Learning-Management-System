export interface PasswordResetNotifierPort {
  sendPasswordReset(email: string, token: string): Promise<void>;
}

export const PASSWORD_RESET_NOTIFIER = Symbol(
  'identity.password-reset-notifier',
);
