import type { LearningRepositoryPort } from '../ports/learning-repository.port';
import { ExpireEnrollmentsUseCase } from './learning-maintenance.use-case';

describe('ExpireEnrollmentsUseCase', () => {
  it('delegates expiration using an explicit clock', async () => {
    const expireEnrollments = jest.fn().mockResolvedValue(3);
    const repository = {
      expireEnrollments,
    } as unknown as LearningRepositoryPort;
    const now = new Date('2026-08-13T12:00:00.000Z');

    await expect(
      new ExpireEnrollmentsUseCase(repository).execute(now),
    ).resolves.toBe(3);
    expect(expireEnrollments).toHaveBeenCalledWith(now);
  });
});
