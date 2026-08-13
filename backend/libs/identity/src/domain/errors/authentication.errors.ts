import { DomainError } from '@lms/shared-kernel';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'The email or password is incorrect.');
  }
}

export class AccountNotActiveError extends DomainError {
  constructor() {
    super('ACCOUNT_NOT_ACTIVE', 'This account is not active.');
  }
}

export class DeviceLimitReachedError extends DomainError {
  constructor() {
    super(
      'DEVICE_LIMIT_REACHED',
      'The registered-device limit has been reached.',
    );
  }
}

export class DeviceRevokedError extends DomainError {
  constructor() {
    super('DEVICE_REVOKED', 'This device has been revoked.');
  }
}

export class RefreshTokenInvalidError extends DomainError {
  constructor() {
    super('REFRESH_TOKEN_INVALID', 'The refresh token is invalid or expired.');
  }
}

export class RefreshTokenReusedError extends DomainError {
  constructor() {
    super(
      'REFRESH_TOKEN_REUSED',
      'Refresh-token reuse was detected; the session has been revoked.',
    );
  }
}

export class AccessTokenInvalidError extends DomainError {
  constructor() {
    super('ACCESS_TOKEN_INVALID', 'The access token is invalid or expired.');
  }
}

export class PermissionDeniedError extends DomainError {
  constructor() {
    super(
      'PERMISSION_DENIED',
      'You do not have permission to perform this operation.',
    );
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor() {
    super('RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
}

export class InvalidProfileUpdateError extends DomainError {
  constructor() {
    super(
      'INVALID_PROFILE_UPDATE',
      'At least one profile field must be provided.',
    );
  }
}

export class PasswordResetTokenInvalidError extends DomainError {
  constructor() {
    super(
      'PASSWORD_RESET_TOKEN_INVALID',
      'The password reset token is invalid or expired.',
    );
  }
}
