import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import {
  IdempotencyKeyConflictError,
  IdempotencyKeyRequiredError,
} from '../../domain';

export interface IdempotentExecution<T> {
  value: T;
  replayed: boolean;
}

interface ExecuteIdempotentlyInput<T> {
  actorUserId: string;
  scope: string;
  key: string | undefined;
  request: unknown;
  responseStatus: number;
  ttlSeconds?: number;
  handler: () => Promise<T>;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    input: ExecuteIdempotentlyInput<T>,
  ): Promise<IdempotentExecution<T>> {
    const key = this.validateKey(input.key);
    const requestHash = createHash('sha256')
      .update(this.stableJson(input.request))
      .digest('hex');

    await this.prisma.idempotencyKey.deleteMany({
      where: {
        actorUserId: input.actorUserId,
        scope: input.scope,
        key,
        expiresAt: { lte: new Date() },
      },
    });

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          actorUserId: input.actorUserId,
          scope: input.scope,
          key,
          requestHash,
          expiresAt: new Date(
            Date.now() + (input.ttlSeconds ?? 24 * 60 * 60) * 1000,
          ),
        },
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraint(error)) throw error;
      const existing = await this.prisma.idempotencyKey.findUniqueOrThrow({
        where: {
          actorUserId_scope_key: {
            actorUserId: input.actorUserId,
            scope: input.scope,
            key,
          },
        },
      });
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyKeyConflictError(
          'The idempotency key was already used with a different request.',
        );
      }
      if (existing.responseStatus === null || existing.responseBody === null) {
        throw new IdempotencyKeyConflictError(
          'The original request with this idempotency key is still processing.',
        );
      }
      return { value: existing.responseBody as T, replayed: true };
    }

    try {
      const value = await input.handler();
      const serialized = JSON.parse(JSON.stringify(value)) as object;
      await this.prisma.idempotencyKey.update({
        where: {
          actorUserId_scope_key: {
            actorUserId: input.actorUserId,
            scope: input.scope,
            key,
          },
        },
        data: {
          responseStatus: input.responseStatus,
          responseBody: serialized,
        },
      });
      return { value, replayed: false };
    } catch (error: unknown) {
      await this.prisma.idempotencyKey.deleteMany({
        where: {
          actorUserId: input.actorUserId,
          scope: input.scope,
          key,
          responseStatus: null,
        },
      });
      throw error;
    }
  }

  private validateKey(key: string | undefined): string {
    if (key === undefined || key.length < 16 || key.length > 128) {
      throw new IdempotencyKeyRequiredError();
    }
    return key;
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
      return `{${Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
