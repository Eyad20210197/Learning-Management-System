import { DomainError } from '@lms/shared-kernel';

export class InvalidEmailError extends DomainError {
  constructor() {
    super('INVALID_EMAIL', 'The email address is invalid.');
  }
}
