import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  PasswordResetConsumeResult,
  PasswordResetRepositoryPort,
} from '../../application';

@Injectable()
export class PrismaPasswordResetRepository implements PasswordResetRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUserIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  async replacePasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.oneTimeToken.updateMany({
        where: {
          userId: input.userId,
          type: 'PASSWORD_RESET',
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.oneTimeToken.create({
        data: { ...input, type: 'PASSWORD_RESET' },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: 'auth.password_reset_requested',
          targetType: 'user',
          targetId: input.userId,
        },
      });
    });
  }

  async consumePasswordResetToken(input: {
    tokenHash: string;
    newPasswordHash: string;
  }): Promise<PasswordResetConsumeResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.oneTimeToken.findUnique({
        where: { tokenHash: input.tokenHash },
        select: {
          id: true,
          userId: true,
          type: true,
          expiresAt: true,
          consumedAt: true,
        },
      });
      if (
        token === null ||
        token.type !== 'PASSWORD_RESET' ||
        token.consumedAt !== null ||
        token.expiresAt <= new Date()
      ) {
        return 'invalid';
      }

      const consumed = await tx.oneTimeToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return 'invalid';

      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: input.newPasswordHash },
      });
      const revokedAt = new Date();
      await tx.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt, revokeReason: 'PASSWORD_RESET' },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId: token.userId }, revokedAt: null },
        data: { revokedAt },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: token.userId,
          action: 'auth.password_reset_completed',
          targetType: 'user',
          targetId: token.userId,
        },
      });
      return 'consumed';
    });
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return user?.passwordHash ?? null;
  }

  async changePassword(input: {
    userId: string;
    newPasswordHash: string;
    currentSessionId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: { passwordHash: input.newPasswordHash },
      });
      const revokedAt = new Date();
      await tx.authSession.updateMany({
        where: {
          userId: input.userId,
          id: { not: input.currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt, revokeReason: 'PASSWORD_CHANGED' },
      });
      await tx.refreshToken.updateMany({
        where: {
          session: {
            userId: input.userId,
            id: { not: input.currentSessionId },
          },
          revokedAt: null,
        },
        data: { revokedAt },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: 'auth.password_changed',
          targetType: 'user',
          targetId: input.userId,
        },
      });
    });
  }
}
