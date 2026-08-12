import { ConfigService } from '@nestjs/config';
import {
  InvalidCredentialsError,
  PasswordResetTokenInvalidError,
} from '../../domain';
import type {
  PasswordHasherPort,
  PasswordResetNotifierPort,
  PasswordResetRepositoryPort,
  TokenServicePort,
} from '../ports';
import {
  ChangePasswordUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
} from './password.use-cases';

describe('password use cases', () => {
  it('does not reveal whether a reset email exists', async () => {
    const findUserIdByEmail = jest.fn().mockResolvedValue(null);
    const sendPasswordReset = jest.fn();
    const passwords = {
      findUserIdByEmail,
    } as unknown as PasswordResetRepositoryPort;
    const notifier = { sendPasswordReset } as PasswordResetNotifierPort;
    await new RequestPasswordResetUseCase(
      passwords,
      notifier,
      {} as TokenServicePort,
      { getOrThrow: jest.fn() } as unknown as ConfigService,
    ).execute('Nobody@Example.com');
    expect(findUserIdByEmail).toHaveBeenCalledWith('nobody@example.com');
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it('persists only a token hash before notifying a known account', async () => {
    const replacePasswordResetToken = jest.fn().mockResolvedValue(undefined);
    const sendPasswordReset = jest.fn().mockResolvedValue(undefined);
    const passwords = {
      findUserIdByEmail: jest.fn().mockResolvedValue('user-id'),
      replacePasswordResetToken,
    } as unknown as PasswordResetRepositoryPort;
    const tokens = {
      issueRefreshToken: jest.fn().mockReturnValue('raw-secret-token'),
      hashRefreshToken: jest.fn().mockReturnValue('hashed-token'),
    } as unknown as TokenServicePort;
    await new RequestPasswordResetUseCase(
      passwords,
      { sendPasswordReset },
      tokens,
      {
        getOrThrow: jest.fn().mockReturnValue(3600),
      } as unknown as ConfigService,
    ).execute('student@example.com');
    expect(replacePasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', tokenHash: 'hashed-token' }),
    );
    expect(sendPasswordReset).toHaveBeenCalledWith(
      'student@example.com',
      'raw-secret-token',
    );
  });

  it('rejects consumed or expired reset tokens', async () => {
    const passwords = {
      consumePasswordResetToken: jest.fn().mockResolvedValue('invalid'),
    } as unknown as PasswordResetRepositoryPort;
    const hasher = {
      hash: jest.fn().mockResolvedValue('new-hash'),
    } as unknown as PasswordHasherPort;
    const tokens = {
      hashRefreshToken: jest.fn().mockReturnValue('token-hash'),
    } as unknown as TokenServicePort;
    await expect(
      new ResetPasswordUseCase(passwords, hasher, tokens).execute(
        'a'.repeat(48),
        'a very strong new password',
      ),
    ).rejects.toBeInstanceOf(PasswordResetTokenInvalidError);
  });

  it('does not change a password when current credentials are wrong', async () => {
    const changePassword = jest.fn();
    const passwords = {
      getPasswordHash: jest.fn().mockResolvedValue('old-hash'),
      changePassword,
    } as unknown as PasswordResetRepositoryPort;
    const hasher = {
      verify: jest.fn().mockResolvedValue(false),
      hash: jest.fn(),
    } as unknown as PasswordHasherPort;
    await expect(
      new ChangePasswordUseCase(passwords, hasher).execute({
        userId: 'user',
        currentSessionId: 'session',
        currentPassword: 'wrong',
        newPassword: 'a very strong new password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(changePassword).not.toHaveBeenCalled();
  });
});
