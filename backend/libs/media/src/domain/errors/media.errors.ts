import { DomainError } from '@lms/shared-kernel';

export class MediaResourceNotFoundError extends DomainError {
  constructor() {
    super(
      'MEDIA_RESOURCE_NOT_FOUND',
      'The requested media resource was not found.',
    );
  }
}
export class InvalidUploadError extends DomainError {
  constructor(message: string) {
    super('INVALID_UPLOAD', message);
  }
}
export class UploadStateConflictError extends DomainError {
  constructor(
    message = 'The upload cannot transition from its current state.',
  ) {
    super('UPLOAD_STATE_CONFLICT', message);
  }
}
