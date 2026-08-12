import { DomainError } from '@lms/shared-kernel';

export class IdempotencyKeyRequiredError extends DomainError {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid Idempotency-Key header is required for this operation.',
    );
  }
}

export class IdempotencyKeyConflictError extends DomainError {
  constructor(message = 'The idempotency key is already in use.') {
    super('IDEMPOTENCY_KEY_CONFLICT', message);
  }
}
