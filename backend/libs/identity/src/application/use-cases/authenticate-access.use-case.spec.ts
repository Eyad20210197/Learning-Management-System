import { AccessTokenInvalidError } from '../../domain';
import type { AuthSessionRepositoryPort, TokenServicePort } from '../ports';
import { AuthenticateAccessUseCase } from './authenticate-access.use-case';

describe('AuthenticateAccessUseCase', () => {
  it('rejects access immediately after its session or device is revoked', async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        userId: 'user',
        sessionId: 'session',
        deviceId: 'device',
        roles: [],
        permissions: [],
      }),
    } as unknown as TokenServicePort;
    const sessions = {
      findActivePrincipal: jest.fn().mockResolvedValue(null),
    } as unknown as AuthSessionRepositoryPort;
    await expect(
      new AuthenticateAccessUseCase(sessions, tokens).execute('signed-token'),
    ).rejects.toBeInstanceOf(AccessTokenInvalidError);
  });
});
