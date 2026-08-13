import { DomainError } from '@lms/shared-kernel';

export class OperationsResourceNotFoundError extends DomainError {
  constructor() {
    super('RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
}

export class InvalidCursorError extends DomainError {
  constructor() {
    super('INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}

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
