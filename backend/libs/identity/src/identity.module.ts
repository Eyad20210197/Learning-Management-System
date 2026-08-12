import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@lms/platform';
import {
  PASSWORD_HASHER,
  AUTH_SESSION_REPOSITORY,
  AuthenticateAccessUseCase,
  ChangePasswordUseCase,
  ListDevicesUseCase,
  LoginUseCase,
  LogoutAllUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  RevokeDeviceUseCase,
  RegisterStudentUseCase,
  TOKEN_SERVICE,
  PASSWORD_RESET_NOTIFIER,
  PASSWORD_RESET_REPOSITORY,
  USER_REPOSITORY,
} from './application';
import {
  Argon2PasswordHasherAdapter,
  JwtTokenService,
  LoggingPasswordResetNotifier,
  PrismaAuthSessionRepository,
  PrismaPasswordResetRepository,
  SmtpPasswordResetNotifier,
  PrismaUserRepository,
} from './infrastructure';
import {
  AccessTokenGuard,
  AccountController,
  AuthController,
  PermissionGuard,
  RefreshOriginGuard,
} from './presentation';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AuthController, AccountController],
  providers: [
    RegisterStudentUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    AuthenticateAccessUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    ListDevicesUseCase,
    RevokeDeviceUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    AccessTokenGuard,
    PermissionGuard,
    RefreshOriginGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasherAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useClass: PrismaPasswordResetRepository,
    },
    {
      provide: PASSWORD_RESET_NOTIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>('app.nodeEnv') === 'production'
          ? new SmtpPasswordResetNotifier(config)
          : new LoggingPasswordResetNotifier(config),
    },
  ],
  exports: [
    RegisterStudentUseCase,
    AuthenticateAccessUseCase,
    AccessTokenGuard,
    PermissionGuard,
  ],
})
export class IdentityModule {}
