import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class RefreshOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    const allowed = this.config.getOrThrow<string[]>('app.corsOrigins');
    if (origin === undefined || !allowed.includes(origin)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'The request origin is not allowed.',
      });
    }
    return true;
  }
}
