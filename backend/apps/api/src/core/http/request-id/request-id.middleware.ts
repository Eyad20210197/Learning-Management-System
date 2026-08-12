import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const candidate = request.header(REQUEST_ID_HEADER);
    const requestId =
      candidate !== undefined && UUID_PATTERN.test(candidate)
        ? candidate
        : randomUUID();

    request.id = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
