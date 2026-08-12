import {
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
} from '../../domain';
import type { AuthSessionRepositoryPort, TokenServicePort } from '../ports';
import { RefreshSessionUseCase } from './refresh-session.use-case';

describe('RefreshSessionUseCase', () => {
  const tokenService = {
    issueRefreshToken: jest.fn().mockReturnValue('replacement'),
    hashRefreshToken: jest.fn((value: string) => `${value}-hash`),
    refreshTokenExpiresAt: jest
      .fn()
      .mockReturnValue(new Date('2026-09-12T00:00:00Z')),
    issueAccessToken: jest
      .fn()
      .mockResolvedValue({ value: 'access', expiresInSeconds: 900 }),
  } as unknown as TokenServicePort;

  it.each([
    ['invalid', RefreshTokenInvalidError],
    ['reused', RefreshTokenReusedError],
  ] as const)(
    'maps %s rotation outcomes to stable security errors',
    async (kind, expected) => {
      const repository = {
        rotateRefreshToken: jest.fn().mockResolvedValue({ kind }),
      } as unknown as AuthSessionRepositoryPort;
      await expect(
        new RefreshSessionUseCase(repository, tokenService).execute(
          'a'.repeat(48),
          {},
        ),
      ).rejects.toBeInstanceOf(expected);
    },
  );

  it('returns a replacement refresh token only after successful rotation', async () => {
    const principal = {
      user: { id: 'user', roles: ['STUDENT'] },
      sessionId: 'session',
      deviceId: 'device',
      permissions: [],
    };
    const rotateRefreshToken = jest
      .fn()
      .mockResolvedValue({ kind: 'rotated', principal });
    const repository = {
      rotateRefreshToken,
    } as unknown as AuthSessionRepositoryPort;
    const result = await new RefreshSessionUseCase(
      repository,
      tokenService,
    ).execute('a'.repeat(48), {});
    expect(result).toEqual({
      accessToken: 'access',
      accessTokenExpiresIn: 900,
      refreshToken: 'replacement',
    });
  });
});
