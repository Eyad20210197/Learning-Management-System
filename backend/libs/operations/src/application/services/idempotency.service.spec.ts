import { createHash } from 'node:crypto';
import type { PrismaService } from '@lms/platform';
import {
  IdempotencyKeyConflictError,
  IdempotencyKeyRequiredError,
} from '../../domain';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const create = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    idempotencyKey: { create, findUniqueOrThrow, update, deleteMany },
  } as unknown as PrismaService;
  const service = new IdempotencyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 0 });
  });

  it('rejects missing and malformed keys before executing the handler', async () => {
    const handler = jest.fn();
    await expect(
      service.execute({
        actorUserId: 'actor',
        scope: 'course.create',
        key: 'short',
        request: {},
        responseStatus: 201,
        handler,
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyRequiredError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('stores the result of the first successful execution', async () => {
    create.mockResolvedValue({});
    update.mockResolvedValue({});
    const handler = jest.fn().mockResolvedValue({ id: 'course-1' });

    await expect(
      service.execute({
        actorUserId: 'actor',
        scope: 'course.create',
        key: 'create-course-key-0001',
        request: { title: 'Course', slug: 'course' },
        responseStatus: 201,
        handler,
      }),
    ).resolves.toEqual({ value: { id: 'course-1' }, replayed: false });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { responseStatus: 201, responseBody: { id: 'course-1' } },
      }),
    );
  });

  it('replays a completed identical request without executing it again', async () => {
    const request = { slug: 'course', title: 'Course' };
    create.mockRejectedValue({ code: 'P2002' });
    findUniqueOrThrow.mockResolvedValue({
      requestHash: createHash('sha256')
        .update('{"slug":"course","title":"Course"}')
        .digest('hex'),
      responseStatus: 201,
      responseBody: { id: 'course-1' },
    });
    const handler = jest.fn();

    const result = await service.execute({
      actorUserId: 'actor',
      scope: 'course.create',
      key: 'create-course-key-0001',
      request,
      responseStatus: 201,
      handler,
    });

    expect(result.replayed).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects reuse with a different request payload', async () => {
    create.mockRejectedValue({ code: 'P2002' });
    findUniqueOrThrow.mockResolvedValue({
      requestHash: 'different',
      responseStatus: 201,
      responseBody: { id: 'course-1' },
    });

    await expect(
      service.execute({
        actorUserId: 'actor',
        scope: 'course.create',
        key: 'create-course-key-0001',
        request: { title: 'Changed' },
        responseStatus: 201,
        handler: jest.fn(),
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });
});
