import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticateAccessUseCase } from '../../application';
import { AccessTokenInvalidError } from '../../domain';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateAccessUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (authorization === undefined || !authorization.startsWith('Bearer '))
      throw new AccessTokenInvalidError();
    const token = authorization.slice(7).trim();
    if (token.length === 0) throw new AccessTokenInvalidError();
    (request as AuthenticatedRequest).auth =
      await this.authenticate.execute(token);
    return true;
  }
}
