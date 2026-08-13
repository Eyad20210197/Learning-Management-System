import type { Email, User } from '../../domain';

export interface CreateStudentInput {
  email: Email;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

export interface UserRepositoryPort {
  existsByEmail(email: Email): Promise<boolean>;
  createStudent(input: CreateStudentInput): Promise<User>;
  updateProfile(
    userId: string,
    input: { firstName?: string; lastName?: string },
  ): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('identity.user-repository');
