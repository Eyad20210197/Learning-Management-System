import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionDeniedError } from '../../domain';
import type { AuthenticatedRequest } from './authenticated-request';

const PERMISSIONS_KEY = 'identity.required-permissions';
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().auth;
    if (
      !required.every((permission) =>
        principal.permissions.includes(permission),
      )
    )
      throw new PermissionDeniedError();
    return true;
  }
}
