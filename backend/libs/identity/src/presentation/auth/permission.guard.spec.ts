import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionDeniedError } from '../../domain';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  it('denies a student missing an owner permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['course.write']),
    } as unknown as Reflector;
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ auth: { permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => new PermissionGuard(reflector).canActivate(context)).toThrow(
      PermissionDeniedError,
    );
  });

  it('allows a principal possessing every required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['course.write', 'course.publish']),
    } as unknown as Reflector;
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { permissions: ['course.write', 'course.publish'] },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(new PermissionGuard(reflector).canActivate(context)).toBe(true);
  });
});
