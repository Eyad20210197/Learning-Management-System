import { Email } from '../value-objects/email.value-object';

export type UserStatus =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface UserProperties {
  id: string;
  email: Email;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(private readonly properties: UserProperties) {}

  get id(): string {
    return this.properties.id;
  }

  get email(): Email {
    return this.properties.email;
  }

  get firstName(): string {
    return this.properties.firstName;
  }

  get lastName(): string {
    return this.properties.lastName;
  }

  get status(): UserStatus {
    return this.properties.status;
  }

  get roles(): readonly string[] {
    return this.properties.roles;
  }

  get createdAt(): Date {
    return this.properties.createdAt;
  }

  get updatedAt(): Date {
    return this.properties.updatedAt;
  }
}
