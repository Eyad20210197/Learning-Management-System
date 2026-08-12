import { DomainError } from '@lms/shared-kernel';

export class ResourceNotFoundError extends DomainError {
  constructor() {
    super('RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
}
export class CourseAccessDeniedError extends DomainError {
  constructor() {
    super('COURSE_ACCESS_DENIED', 'You do not have access to this course.');
  }
}
export class EnrollmentNotStartedError extends DomainError {
  constructor() {
    super('ENROLLMENT_NOT_STARTED', 'Your enrollment has not started yet.');
  }
}
export class EnrollmentExpiredError extends DomainError {
  constructor() {
    super('ENROLLMENT_EXPIRED', 'Your enrollment has expired.');
  }
}
export class InvalidStateTransitionError extends DomainError {
  constructor(
    message = 'The resource cannot transition from its current state.',
  ) {
    super('INVALID_STATE_TRANSITION', message);
  }
}
export class SlugAlreadyExistsError extends DomainError {
  constructor() {
    super('INVALID_STATE_TRANSITION', 'A course already uses this slug.');
  }
}
