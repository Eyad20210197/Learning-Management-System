import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('creates a UUID when the caller does not provide one', () => {
    const request = { header: jest.fn().mockReturnValue(undefined) };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(
      request as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(request).toHaveProperty(
      'id',
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps a valid caller request ID', () => {
    const requestId = 'd9428888-122b-41e1-b85c-61f048c6b51a';
    const request = { header: jest.fn().mockReturnValue(requestId) };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(
      request as unknown as Request,
      response as unknown as Response,
      next as NextFunction,
    );

    expect(request).toHaveProperty('id', requestId);
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      requestId,
    );
  });
});
