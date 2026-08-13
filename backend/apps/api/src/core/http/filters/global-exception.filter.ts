import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { DomainError } from '@lms/shared-kernel';
import type { Request } from 'express';

interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details?: { errors: string[] };
  requestId: string;
}

interface ObjectExceptionResponse {
  code?: unknown;
  message?: unknown;
}

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<unknown>();
    const statusCode: HttpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof DomainError
          ? this.domainStatus(exception.code)
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof DomainError
          ? { code: exception.code, message: exception.message }
          : undefined;
    const body = this.createEnvelope(
      statusCode,
      exceptionResponse,
      typeof request.id === 'string' ? request.id : 'unavailable',
    );

    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      const exceptionType =
        exception instanceof Error ? exception.name : typeof exception;
      this.logger.error(
        `Unhandled ${exceptionType} for request ${body.requestId}`,
      );
    }

    this.adapterHost.httpAdapter.reply(response, body, statusCode);
  }

  private createEnvelope(
    statusCode: HttpStatus,
    response: string | object | undefined,
    requestId: string,
  ): ErrorEnvelope {
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        statusCode,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      };
    }

    if (typeof response === 'string') {
      return {
        statusCode,
        code: this.defaultCode(statusCode),
        message: response,
        requestId,
      };
    }

    const objectResponse = (response ?? {}) as ObjectExceptionResponse;
    const messages = Array.isArray(objectResponse.message)
      ? objectResponse.message.filter(
          (message): message is string => typeof message === 'string',
        )
      : undefined;
    const message =
      messages !== undefined
        ? 'Request validation failed'
        : typeof objectResponse.message === 'string'
          ? objectResponse.message
          : 'Request failed';
    const code =
      typeof objectResponse.code === 'string'
        ? objectResponse.code
        : messages !== undefined
          ? 'VALIDATION_FAILED'
          : this.defaultCode(statusCode);

    return {
      statusCode,
      code,
      message,
      ...(messages !== undefined && messages.length > 0
        ? { details: { errors: messages } }
        : {}),
      requestId,
    };
  }

  private defaultCode(statusCode: HttpStatus): string {
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return 'RATE_LIMIT_EXCEEDED';
    }
    return HttpStatus[statusCode] ?? 'HTTP_ERROR';
  }

  private domainStatus(code: string): HttpStatus {
    const statuses: Readonly<Record<string, HttpStatus>> = {
      EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
      INVALID_EMAIL: HttpStatus.BAD_REQUEST,
      INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
      ACCESS_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
      REFRESH_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
      REFRESH_TOKEN_REUSED: HttpStatus.UNAUTHORIZED,
      PASSWORD_RESET_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
      ACCOUNT_NOT_ACTIVE: HttpStatus.FORBIDDEN,
      DEVICE_LIMIT_REACHED: HttpStatus.FORBIDDEN,
      DEVICE_REVOKED: HttpStatus.FORBIDDEN,
      PERMISSION_DENIED: HttpStatus.FORBIDDEN,
      RESOURCE_NOT_FOUND: HttpStatus.NOT_FOUND,
      COURSE_ACCESS_DENIED: HttpStatus.FORBIDDEN,
      ENROLLMENT_NOT_STARTED: HttpStatus.FORBIDDEN,
      ENROLLMENT_EXPIRED: HttpStatus.FORBIDDEN,
      INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
      IDEMPOTENCY_KEY_REQUIRED: HttpStatus.BAD_REQUEST,
      IDEMPOTENCY_KEY_CONFLICT: HttpStatus.CONFLICT,
      MEDIA_RESOURCE_NOT_FOUND: HttpStatus.NOT_FOUND,
      INVALID_UPLOAD: HttpStatus.UNPROCESSABLE_ENTITY,
      UPLOAD_STATE_CONFLICT: HttpStatus.CONFLICT,
      PLAYBACK_UNAVAILABLE: HttpStatus.CONFLICT,
      PLAYBACK_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
      PLAYBACK_REPLACED: HttpStatus.CONFLICT,
      PLAYBACK_REVOKED: HttpStatus.FORBIDDEN,
      PLAYBACK_ENDED: HttpStatus.CONFLICT,
    };

    return statuses[code] ?? HttpStatus.BAD_REQUEST;
  }
}
