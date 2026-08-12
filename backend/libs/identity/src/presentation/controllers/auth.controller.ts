import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  LoginUseCase,
  ChangePasswordUseCase,
  LogoutAllUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  RegisterStudentUseCase,
} from '../../application';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { RefreshOriginGuard } from '../auth/refresh-origin.guard';
import { LoginDto } from '../dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/password.dto';
import { RegisterStudentDto } from '../dto/register-student.dto';
import {
  DevicePresenter,
  type DeviceResponse,
} from '../presenters/device.presenter';
import { UserPresenter, type UserResponse } from '../presenters/user.presenter';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly registerStudent: RegisterStudentUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutSession: LogoutUseCase,
    private readonly logoutAllSessions: LogoutAllUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a student account' })
  @ApiCreatedResponse({ description: 'Student registered' })
  async register(@Body() dto: RegisterStudentDto): Promise<UserResponse> {
    const user = await this.registerStudent.execute(dto);
    return UserPresenter.toResponse(user);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    user: UserResponse;
    device: DeviceResponse;
    accessToken: string;
    accessTokenExpiresIn: number;
  }> {
    const result = await this.loginUser.execute({
      ...dto,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: typeof request.id === 'string' ? request.id : undefined,
    });
    response.cookie(
      'lms_refresh',
      result.refreshToken,
      this.refreshCookieOptions(),
    );
    return {
      user: UserPresenter.toResponse(result.user),
      device: DevicePresenter.toResponse(result.device),
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(RefreshOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; accessTokenExpiresIn: number }> {
    try {
      const result = await this.refreshSession.execute(
        request.cookies?.lms_refresh as string | undefined,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: typeof request.id === 'string' ? request.id : undefined,
        },
      );
      response.cookie(
        'lms_refresh',
        result.refreshToken,
        this.refreshCookieOptions(),
      );
      return {
        accessToken: result.accessToken,
        accessTokenExpiresIn: result.accessTokenExpiresIn,
      };
    } catch (error: unknown) {
      response.clearCookie('lms_refresh', this.refreshCookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutSession.execute(request.auth.sessionId);
    response.clearCookie('lms_refresh', this.refreshCookieOptions());
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutAllSessions.execute(request.auth.user.id);
    response.clearCookie('lms_refresh', this.refreshCookieOptions());
  }

  @Post('password/forgot')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.requestPasswordReset.execute(dto.email);
  }

  @Post('password/reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetForgottenPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPassword.execute(dto.token, dto.newPassword);
  }

  @Post('password/change')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async changeCurrentPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.changePassword.execute({
      userId: request.auth.user.id,
      currentSessionId: request.auth.sessionId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<string>('app.nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge:
        this.config.getOrThrow<number>('app.refreshTokenTtlSeconds') * 1000,
    };
  }
}
