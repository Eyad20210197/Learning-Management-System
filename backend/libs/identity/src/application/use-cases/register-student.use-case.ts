import { Inject, Injectable } from '@nestjs/common';
import { Email, EmailAlreadyRegisteredError, type User } from '../../domain';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../ports/user-repository.port';

export interface RegisterStudentCommand {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class RegisterStudentUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(command: RegisterStudentCommand): Promise<User> {
    const email = Email.create(command.email);

    if (await this.users.existsByEmail(email)) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    return this.users.createStudent({
      email,
      passwordHash,
      firstName: command.firstName.trim(),
      lastName: command.lastName.trim(),
    });
  }
}
