import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
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
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
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
    return HttpStatus[statusCode] ?? 'HTTP_ERROR';
  }
}
