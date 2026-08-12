import { Inject, Injectable } from '@nestjs/common';
import type { Device } from '../../domain';
import { ResourceNotFoundError } from '../../domain';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
} from '../ports/auth-session-repository.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
  ) {}
  execute(sessionId: string): Promise<void> {
    return this.sessions.revokeSession(sessionId, 'LOGOUT');
  }
}

@Injectable()
export class LogoutAllUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
  ) {}
  execute(userId: string): Promise<void> {
    return this.sessions.revokeAllSessions(userId, 'LOGOUT_ALL');
  }
}

@Injectable()
export class ListDevicesUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
  ) {}
  execute(userId: string): Promise<Device[]> {
    return this.sessions.listDevices(userId);
  }
}

@Injectable()
export class RevokeDeviceUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: AuthSessionRepositoryPort,
  ) {}
  async execute(userId: string, deviceId: string): Promise<void> {
    if (!(await this.sessions.revokeDevice(userId, deviceId)))
      throw new ResourceNotFoundError();
  }
}
