import type { User } from '../../domain';

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export class UserPresenter {
  static toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
