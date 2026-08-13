import { Inject, Injectable } from '@nestjs/common';
import { InvalidProfileUpdateError, ResourceNotFoundError } from '../../domain';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../ports/user-repository.port';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(
    userId: string,
    input: { firstName?: string; lastName?: string },
  ) {
    if (input.firstName === undefined && input.lastName === undefined)
      throw new InvalidProfileUpdateError();
    const user = await this.users.updateProfile(userId, input);
    if (user === null) throw new ResourceNotFoundError();
    return user;
  }
}
