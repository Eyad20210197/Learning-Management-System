import type { Device, User } from '../../domain';

export interface LoginIdentity {
  user: User;
  passwordHash: string;
  permissions: readonly string[];
}

export interface DeviceDescriptor {
  clientDeviceId: string;
  name: string;
  browser?: string;
  operatingSystem?: string;
  userAgent?: string;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface SessionPrincipal {
  user: User;
  sessionId: string;
  deviceId: string;
  permissions: readonly string[];
}

export interface CreatedSession extends SessionPrincipal {
  device: Device;
}

export type RefreshRotationResult =
  | { kind: 'rotated'; principal: SessionPrincipal }
  | { kind: 'invalid' }
  | { kind: 'reused' };

export interface AuthSessionRepositoryPort {
  findLoginIdentity(email: string): Promise<LoginIdentity | null>;
  createSession(input: {
    userId: string;
    device: DeviceDescriptor;
    refreshTokenHash: string;
    refreshTokenExpiresAt: Date;
    maxRegisteredDevices: number;
    metadata: RequestMetadata;
  }): Promise<CreatedSession>;
  rotateRefreshToken(input: {
    presentedTokenHash: string;
    replacementTokenHash: string;
    replacementExpiresAt: Date;
    metadata: RequestMetadata;
  }): Promise<RefreshRotationResult>;
  findActivePrincipal(input: {
    userId: string;
    sessionId: string;
    deviceId: string;
  }): Promise<SessionPrincipal | null>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  revokeAllSessions(userId: string, reason: string): Promise<void>;
  listDevices(userId: string): Promise<Device[]>;
  revokeDevice(userId: string, deviceId: string): Promise<boolean>;
}

export const AUTH_SESSION_REPOSITORY = Symbol(
  'identity.auth-session-repository',
);
