import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessTokenGuard, type SessionPrincipal } from '@lms/identity';
import { IdempotencyService } from '@lms/operations';
import type { CookieOptions, Request, Response } from 'express';
import {
  CreatePlaybackSessionUseCase,
  EndPlaybackSessionUseCase,
  HeartbeatPlaybackSessionUseCase,
  IssueMediaLeaseUseCase,
} from '../../application';
import { PlaybackHeartbeatDto } from '../dto/playback.dto';
import {
  PlaybackPresenter,
  type PlaybackSessionResponse,
} from '../presenters/playback.presenter';

const MEDIA_COOKIE = 'lms_media_lease';

interface AuthenticatedRequest extends Request {
  auth: SessionPrincipal;
}

@Controller({ path: 'me', version: '1' })
@UseGuards(AccessTokenGuard)
export class PlaybackController {
  constructor(
    private readonly createSession: CreatePlaybackSessionUseCase,
    private readonly heartbeatSession: HeartbeatPlaybackSessionUseCase,
    private readonly endSession: EndPlaybackSessionUseCase,
    private readonly issueLease: IssueMediaLeaseUseCase,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {}

  @Post('lessons/:lessonId/playback-sessions')
  async create(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') key: string | undefined,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<PlaybackSessionResponse> {
    const result = await this.idempotency.execute({
      actorUserId: request.auth.user.id,
      scope: `playback.create:${lessonId}`,
      key,
      request: {
        lessonId,
        deviceId: request.auth.deviceId,
        authSessionId: request.auth.sessionId,
      },
      responseStatus: 201,
      ttlSeconds: 300,
      handler: async () =>
        PlaybackPresenter.created(
          await this.createSession.execute({
            principal: request.auth,
            lessonId,
            ipAddress: request.ip,
          }),
        ),
    });
    const lease = await this.issueLease.execute(request.auth, result.value.id);
    this.setLeaseCookie(response, lease.token, lease.expiresAt);
    return { ...result.value, leaseExpiresAt: lease.expiresAt.toISOString() };
  }

  @Post('playback-sessions/:sessionId/heartbeat')
  @HttpCode(200)
  async heartbeat(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: PlaybackHeartbeatDto,
  ): Promise<PlaybackSessionResponse> {
    try {
      const result = await this.heartbeatSession.execute({
        principal: request.auth,
        sessionId,
        positionSeconds: dto.positionSeconds,
      });
      this.setLeaseCookie(response, result.lease.token, result.lease.expiresAt);
      return PlaybackPresenter.heartbeat(result);
    } catch (error: unknown) {
      this.clearLeaseCookie(response);
      throw error;
    }
  }

  @Delete('playback-sessions/:sessionId')
  @HttpCode(204)
  async end(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.endSession.execute(request.auth.user.id, sessionId);
    this.clearLeaseCookie(response);
  }

  private setLeaseCookie(
    response: Response,
    token: string,
    expiresAt: Date,
  ): void {
    response.cookie(MEDIA_COOKIE, token, {
      ...this.cookieOptions(),
      expires: expiresAt,
    });
  }

  private clearLeaseCookie(response: Response): void {
    response.clearCookie(MEDIA_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<string>('app.nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/media',
    };
  }
}
