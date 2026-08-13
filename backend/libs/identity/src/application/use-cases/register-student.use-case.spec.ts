import { Email, EmailAlreadyRegisteredError, User } from '../../domain';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type {
  CreateStudentInput,
  UserRepositoryPort,
} from '../ports/user-repository.port';
import { RegisterStudentUseCase } from './register-student.use-case';

describe('RegisterStudentUseCase', () => {
  it('normalizes the email and creates a student with a password hash', async () => {
    const hash = jest.fn().mockResolvedValue('argon2-hash');
    const passwordHasher: PasswordHasherPort = {
      hash,
      verify: jest.fn().mockResolvedValue(true),
    };
    const existsByEmail = jest.fn().mockResolvedValue(false);
    const createStudent = jest
      .fn()
      .mockImplementation((input: CreateStudentInput) =>
        Promise.resolve(
          new User({
            id: '0198d03a-81df-7c0f-9908-e700c1c6744d',
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            status: 'ACTIVE',
            roles: ['STUDENT'],
            createdAt: new Date('2026-08-12T00:00:00.000Z'),
            updatedAt: new Date('2026-08-12T00:00:00.000Z'),
          }),
        ),
      );
    const repository: UserRepositoryPort = {
      existsByEmail,
      createStudent,
      updateProfile: jest.fn(),
    };
    const useCase = new RegisterStudentUseCase(repository, passwordHasher);

    const user = await useCase.execute({
      email: '  Student@Example.COM ',
      password: 'correct horse battery staple',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
    });

    expect(existsByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'student@example.com' }),
    );
    expect(hash).toHaveBeenCalledWith('correct horse battery staple');
    expect(createStudent).toHaveBeenCalledWith({
      email: expect.objectContaining({ value: 'student@example.com' }) as Email,
      passwordHash: 'argon2-hash',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(user.roles).toEqual(['STUDENT']);
  });

  it('rejects an email that already exists before hashing', async () => {
    const hash = jest.fn().mockResolvedValue('argon2-hash');
    const passwordHasher: PasswordHasherPort = {
      hash,
      verify: jest.fn().mockResolvedValue(true),
    };
    const createStudent = jest.fn();
    const repository: UserRepositoryPort = {
      existsByEmail: jest.fn().mockResolvedValue(true),
      createStudent,
      updateProfile: jest.fn(),
    };
    const useCase = new RegisterStudentUseCase(repository, passwordHasher);

    await expect(
      useCase.execute({
        email: 'student@example.com',
        password: 'correct horse battery staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    expect(createStudent).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});
