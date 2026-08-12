import {
  BadRequestException,
  type ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const reply = jest.fn();
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const filter = new GlobalExceptionFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);

  const hostFor = (requestId: string): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ id: requestId }),
        getResponse: () => ({ response: true }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    reply.mockClear();
    loggerError.mockClear();
  });

  afterAll(() => {
    loggerError.mockRestore();
  });

  it('normalizes validation errors', () => {
    const requestId = 'bc829bea-25f7-4802-9574-14452803024b';
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    });

    filter.catch(exception, hostFor(requestId));

    expect(reply).toHaveBeenCalledWith(
      { response: true },
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: { errors: ['email must be an email'] },
        requestId,
      },
      HttpStatus.BAD_REQUEST,
    );
  });

  it('does not expose unexpected exception details', () => {
    filter.catch(
      new Error('database password leaked here'),
      hostFor('ba9afec1-624f-4d93-9f3f-0ec1e7fdfe08'),
    );

    expect(reply).toHaveBeenCalledWith(
      { response: true },
      {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId: 'ba9afec1-624f-4d93-9f3f-0ec1e7fdfe08',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(loggerError).toHaveBeenCalledWith(
      'Unhandled Error for request ba9afec1-624f-4d93-9f3f-0ec1e7fdfe08',
    );
  });
});
