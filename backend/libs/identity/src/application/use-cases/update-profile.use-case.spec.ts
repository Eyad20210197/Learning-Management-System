import {
  Email,
  InvalidProfileUpdateError,
  ResourceNotFoundError,
  User,
} from '../../domain';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { UpdateProfileUseCase } from './update-profile.use-case';

const user = new User({
  id: '0198d03a-81df-7c0f-9908-e700c1c6744d',
  email: Email.create('student@example.com'),
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: 'ACTIVE',
  roles: ['STUDENT'],
  createdAt: new Date('2026-08-13T00:00:00.000Z'),
  updatedAt: new Date('2026-08-13T00:00:00.000Z'),
});

function repository(
  updateProfile = jest.fn().mockResolvedValue(user),
): UserRepositoryPort {
  return {
    existsByEmail: jest.fn(),
    createStudent: jest.fn(),
    updateProfile,
  };
}

describe('UpdateProfileUseCase', () => {
  it('delegates a partial update to the user repository', async () => {
    const updateProfile = jest.fn().mockResolvedValue(user);
    const useCase = new UpdateProfileUseCase(repository(updateProfile));

    await expect(
      useCase.execute(user.id, { firstName: 'Grace' }),
    ).resolves.toBe(user);
    expect(updateProfile).toHaveBeenCalledWith(user.id, { firstName: 'Grace' });
  });

  it('rejects an empty profile patch', async () => {
    const useCase = new UpdateProfileUseCase(repository());

    await expect(useCase.execute(user.id, {})).rejects.toBeInstanceOf(
      InvalidProfileUpdateError,
    );
  });

  it('does not reveal whether an unknown account has profile data', async () => {
    const useCase = new UpdateProfileUseCase(
      repository(jest.fn().mockResolvedValue(null)),
    );

    await expect(
      useCase.execute(user.id, { lastName: 'Hopper' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
