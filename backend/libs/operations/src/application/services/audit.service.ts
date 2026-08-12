import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@lms/platform';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  requestId?: string;
  metadata?: Readonly<Record<string, unknown>>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        requestId: entry.requestId,
        metadata:
          entry.metadata === undefined
            ? undefined
            : ({ ...entry.metadata } as Prisma.InputJsonObject),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}
