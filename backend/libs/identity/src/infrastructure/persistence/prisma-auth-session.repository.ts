import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  AuthSessionRepositoryPort,
  CreatedSession,
  LoginIdentity,
  RefreshRotationResult,
  SessionPrincipal,
} from '../../application';
import {
  DeviceLimitReachedError,
  DeviceRevokedError,
  Device,
  Email,
  User,
} from '../../domain';

type UserWithAuthorization = Awaited<
  ReturnType<PrismaAuthSessionRepository['findUserWithAuthorization']>
>;

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const record = await this.findUserWithAuthorization(email);
    if (record === null) return null;
    return {
      user: this.toUser(record),
      passwordHash: record.passwordHash,
      permissions: this.permissions(record),
    };
  }

  async createSession(
    input: Parameters<AuthSessionRepositoryPort['createSession']>[0],
  ): Promise<CreatedSession> {
    return this.retrySerializable(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.device.findUnique({
            where: {
              userId_clientDeviceUuid: {
                userId: input.userId,
                clientDeviceUuid: input.device.clientDeviceId,
              },
            },
          });
          if (existing?.revokedAt) throw new DeviceRevokedError();
          if (existing === null) {
            const activeCount = await tx.device.count({
              where: { userId: input.userId, revokedAt: null },
            });
            if (activeCount >= input.maxRegisteredDevices)
              throw new DeviceLimitReachedError();
          }
          const device = await tx.device.upsert({
            where: {
              userId_clientDeviceUuid: {
                userId: input.userId,
                clientDeviceUuid: input.device.clientDeviceId,
              },
            },
            create: {
              userId: input.userId,
              clientDeviceUuid: input.device.clientDeviceId,
              name: input.device.name.trim(),
              browser: input.device.browser,
              operatingSystem: input.device.operatingSystem,
              userAgent: input.device.userAgent,
            },
            update: {
              name: input.device.name.trim(),
              browser: input.device.browser,
              operatingSystem: input.device.operatingSystem,
              userAgent: input.device.userAgent,
              lastSeenAt: new Date(),
            },
          });
          const session = await tx.authSession.create({
            data: {
              userId: input.userId,
              deviceId: device.id,
              ipAddress: input.metadata.ipAddress,
              userAgent: input.metadata.userAgent,
              refreshTokens: {
                create: {
                  tokenHash: input.refreshTokenHash,
                  expiresAt: input.refreshTokenExpiresAt,
                },
              },
            },
          });
          await tx.user.update({
            where: { id: input.userId },
            data: { lastLoginAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: input.userId,
              action: 'auth.login',
              targetType: 'auth_session',
              targetId: session.id,
              requestId: input.metadata.requestId,
              ipAddress: input.metadata.ipAddress,
              userAgent: input.metadata.userAgent,
            },
          });
          const user = await this.findUserWithAuthorizationById(
            input.userId,
            tx,
          );
          if (user === null)
            throw new Error(
              'Authenticated user disappeared during session creation',
            );
          return {
            ...this.toPrincipal(user, session.id, device.id),
            device: this.toDevice(device),
          };
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  async rotateRefreshToken(
    input: Parameters<AuthSessionRepositoryPort['rotateRefreshToken']>[0],
  ): Promise<RefreshRotationResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash: input.presentedTokenHash },
        include: {
          session: {
            include: {
              device: true,
              user: {
                include: {
                  roles: {
                    include: {
                      role: {
                        include: {
                          permissions: { include: { permission: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (
        token === null ||
        token.expiresAt <= new Date() ||
        token.revokedAt !== null ||
        token.session.revokedAt !== null ||
        token.session.device.revokedAt !== null ||
        token.session.user.status !== 'ACTIVE'
      ) {
        return { kind: 'invalid' };
      }
      const consumed = await tx.refreshToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1 || token.usedAt !== null) {
        await tx.authSession.update({
          where: { id: token.sessionId },
          data: { revokedAt: new Date(), revokeReason: 'REFRESH_TOKEN_REUSED' },
        });
        await tx.refreshToken.updateMany({
          where: { sessionId: token.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.securityEvent.create({
          data: {
            userId: token.session.userId,
            deviceId: token.session.deviceId,
            type: 'REFRESH_TOKEN_REUSED',
            severity: 'CRITICAL',
            metadata: {
              requestId: input.metadata.requestId,
              ipAddress: input.metadata.ipAddress,
            },
          },
        });
        return { kind: 'reused' };
      }
      await tx.refreshToken.create({
        data: {
          sessionId: token.sessionId,
          parentTokenId: token.id,
          tokenHash: input.replacementTokenHash,
          expiresAt: input.replacementExpiresAt,
        },
      });
      await tx.authSession.update({
        where: { id: token.sessionId },
        data: { lastSeenAt: new Date(), ipAddress: input.metadata.ipAddress },
      });
      return {
        kind: 'rotated',
        principal: this.toPrincipal(
          token.session.user,
          token.sessionId,
          token.session.deviceId,
        ),
      };
    });
  }

  async findActivePrincipal(
    input: Parameters<AuthSessionRepositoryPort['findActivePrincipal']>[0],
  ): Promise<SessionPrincipal | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        deviceId: input.deviceId,
        revokedAt: null,
        device: { revokedAt: null },
        user: { status: 'ACTIVE' },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });
    return session === null
      ? null
      : this.toPrincipal(session.user, session.id, session.deviceId);
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      }),
      this.prisma.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async listDevices(userId: string): Promise<Device[]> {
    return (
      await this.prisma.device.findMany({
        where: { userId },
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      })
    ).map((device) => this.toDevice(device));
  }

  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.device.updateMany({
        where: { id: deviceId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (changed.count === 0) return false;
      await tx.authSession.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'DEVICE_REVOKED' },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId, deviceId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'device.revoke',
          targetType: 'device',
          targetId: deviceId,
        },
      });
      return true;
    });
  }

  private findUserWithAuthorization(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  private findUserWithAuthorizationById(
    id: string,
    client: Pick<PrismaService, 'user'>,
  ) {
    return client.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  private toUser(record: NonNullable<UserWithAuthorization>): User {
    return new User({
      id: record.id,
      email: Email.create(record.email),
      firstName: record.firstName,
      lastName: record.lastName,
      status: record.status,
      roles: record.roles.map(({ role }) => role.name),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private permissions(record: NonNullable<UserWithAuthorization>): string[] {
    return [
      ...new Set(
        record.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ].sort();
  }

  private toPrincipal(
    record: NonNullable<UserWithAuthorization>,
    sessionId: string,
    deviceId: string,
  ): SessionPrincipal {
    return {
      user: this.toUser(record),
      sessionId,
      deviceId,
      permissions: this.permissions(record),
    };
  }

  private toDevice(record: {
    id: string;
    clientDeviceUuid: string;
    name: string;
    browser: string | null;
    operatingSystem: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
  }): Device {
    return new Device({
      id: record.id,
      clientDeviceId: record.clientDeviceUuid,
      name: record.name,
      browser: record.browser,
      operatingSystem: record.operatingSystem,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      revokedAt: record.revokedAt,
    });
  }

  private async retrySerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error: unknown) {
        if (
          !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2034'
          ) ||
          attempt === 3
        )
          throw error;
      }
    }
    throw new Error('Serializable transaction retry exhausted');
  }
}
