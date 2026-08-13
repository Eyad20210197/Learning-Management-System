import { OperationsResourceNotFoundError } from '../../domain';
import type { OperationsRepositoryPort } from '../ports';
import {
  CleanupExpiredIdempotencyKeysUseCase,
  GetOperationsSummaryUseCase,
  GetStudentSupportUseCase,
} from './operations-query.use-cases';

function repository(): jest.Mocked<OperationsRepositoryPort> {
  return {
    getStudentSupport: jest.fn(),
    listVideoOperations: jest.fn(),
    listAuditLogs: jest.fn(),
    listSecurityEvents: jest.fn(),
    getSummary: jest.fn(),
    deleteExpiredIdempotencyKeys: jest.fn(),
  };
}

describe('operations query use cases', () => {
  it('maps an absent student to the stable resource-not-found error', async () => {
    const operations = repository();
    operations.getStudentSupport.mockResolvedValue(null);

    await expect(
      new GetStudentSupportUseCase(operations).execute('student-id'),
    ).rejects.toBeInstanceOf(OperationsResourceNotFoundError);
  });

  it('uses one captured timestamp for the summary snapshot', async () => {
    const getSummary = jest.fn();
    const operations: jest.Mocked<OperationsRepositoryPort> = {
      ...repository(),
      getSummary,
    };
    getSummary.mockResolvedValue({
      students: 0,
      activeEnrollments: 0,
      publishedCourses: 0,
      videosProcessing: 0,
      videosFailed: 0,
      activePlaybackSessions: 0,
      unresolvedSecurityEvents: 0,
      generatedAt: new Date(),
    });

    await new GetOperationsSummaryUseCase(operations).execute();

    expect(getSummary).toHaveBeenCalledWith(expect.any(Date));
  });

  it('delegates expired idempotency cleanup with the supplied clock', async () => {
    const deleteExpiredIdempotencyKeys = jest.fn();
    const operations: jest.Mocked<OperationsRepositoryPort> = {
      ...repository(),
      deleteExpiredIdempotencyKeys,
    };
    deleteExpiredIdempotencyKeys.mockResolvedValue(2);
    const now = new Date('2026-08-13T12:00:00.000Z');

    await expect(
      new CleanupExpiredIdempotencyKeysUseCase(operations).execute(now),
    ).resolves.toBe(2);
    expect(deleteExpiredIdempotencyKeys).toHaveBeenCalledWith(now);
  });
});
