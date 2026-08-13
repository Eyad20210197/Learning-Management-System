export { RegisterStudentUseCase } from './application';
export type { SessionPrincipal } from './application';
export { Email, User } from './domain';
export * from './identity.module';
export {
  AccessTokenGuard,
  PermissionGuard,
  RequirePermissions,
} from './presentation';
