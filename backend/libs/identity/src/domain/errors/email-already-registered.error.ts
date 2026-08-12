import { DomainError } from '@lms/shared-kernel';

export class EmailAlreadyRegisteredError extends DomainError {
  constructor() {
    super(
      'EMAIL_ALREADY_REGISTERED',
      'An account is already registered with this email address.',
    );
  }
}
