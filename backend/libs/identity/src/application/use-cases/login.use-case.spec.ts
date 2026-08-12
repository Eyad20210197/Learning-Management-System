import { ConfigService } from '@nestjs/config';
import {
  Device,
  DeviceLimitReachedError,
  Email,
  InvalidCredentialsError,
  User,
} from '../../domain';
import type {
  AuthSessionRepositoryPort,
  PasswordHasherPort,
  TokenServicePort,
} from '../ports';
import { LoginUseCase } from './login.use-case';

const user = new User({
  id: '0198d03a-81df-7c0f-9908-e700c1c6744d',
  email: Email.create('student@example.com'),
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: 'ACTIVE',
  roles: ['STUDENT'],
  createdAt: new Date('2026-08-12T00:00:00Z'),
  updatedAt: new Date('2026-08-12T00:00:00Z'),
});
const device = new Device({
  id: '0198d03a-81df-7c0f-9908-e700c1c6744e',
  clientDeviceId: '0198d03a-81df-7c0f-9908-e700c1c6744f',
  name: 'Laptop',
  browser: null,
  operatingSystem: null,
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  revokedAt: null,
});

describe('LoginUseCase', () => {
  const command = {
    email: 'Student@Example.com',
    password: 'correct horse battery staple',
    device: { clientDeviceId: device.clientDeviceId, name: 'Laptop' },
  };

  it('verifies credentials before creating a session and issuing tokens', async () => {
    const findLoginIdentity = jest
      .fn()
      .mockResolvedValue({ user, passwordHash: 'hash', permissions: [] });
    const createSession = jest.fn().mockResolvedValue({
      user,
      device,
      deviceId: device.id,
      sessionId: 'session-id',
      permissions: [],
    });
    const sessions = {
      findLoginIdentity,
      createSession,
    } as unknown as AuthSessionRepositoryPort;
    const verify = jest.fn().mockResolvedValue(true);
    const hasher = { verify, hash: jest.fn() } as PasswordHasherPort;
    const tokens = {
      issueRefreshToken: jest.fn().mockReturnValue('refresh'),
      hashRefreshToken: jest.fn().mockReturnValue('refresh-hash'),
      refreshTokenExpiresAt: jest
        .fn()
        .mockReturnValue(new Date('2026-09-12T00:00:00Z')),
      issueAccessToken: jest
        .fn()
        .mockResolvedValue({ value: 'access', expiresInSeconds: 900 }),
    } as unknown as TokenServicePort;
    const config = {
      getOrThrow: jest.fn().mockReturnValue(5),
    } as unknown as ConfigService;

    const result = await new LoginUseCase(
      sessions,
      hasher,
      tokens,
      config,
    ).execute(command);

    expect(findLoginIdentity).toHaveBeenCalledWith('student@example.com');
    expect(verify).toHaveBeenCalledWith('hash', command.password);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        maxRegisteredDevices: 5,
        refreshTokenHash: 'refresh-hash',
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('returns one indistinguishable error for an unknown email', async () => {
    const sessions = {
      findLoginIdentity: jest.fn().mockResolvedValue(null),
    } as unknown as AuthSessionRepositoryPort;
    const verify = jest.fn();
    const hasher = { verify, hash: jest.fn() } as PasswordHasherPort;
    await expect(
      new LoginUseCase(
        sessions,
        hasher,
        {} as TokenServicePort,
        { getOrThrow: jest.fn() } as unknown as ConfigService,
      ).execute(command),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(verify).not.toHaveBeenCalled();
  });

  it('propagates device policy failures without issuing an access token', async () => {
    const sessions = {
      findLoginIdentity: jest
        .fn()
        .mockResolvedValue({ user, passwordHash: 'hash', permissions: [] }),
      createSession: jest.fn().mockRejectedValue(new DeviceLimitReachedError()),
    } as unknown as AuthSessionRepositoryPort;
    const issueAccessToken = jest.fn();
    const tokens = {
      issueRefreshToken: jest.fn().mockReturnValue('refresh'),
      hashRefreshToken: jest.fn().mockReturnValue('hash'),
      refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date()),
      issueAccessToken,
    } as unknown as TokenServicePort;
    await expect(
      new LoginUseCase(
        sessions,
        { verify: jest.fn().mockResolvedValue(true), hash: jest.fn() },
        tokens,
        {
          getOrThrow: jest.fn().mockReturnValue(1),
        } as unknown as ConfigService,
      ).execute(command),
    ).rejects.toBeInstanceOf(DeviceLimitReachedError);
    expect(issueAccessToken).not.toHaveBeenCalled();
  });
});
