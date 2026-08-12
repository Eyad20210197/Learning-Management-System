import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PlatformConfigModule } from '../config';

const REDACTED = '[Redacted]';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const redactedPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.resetToken',
  'req.body.mediaLease',
  'req.body.secret',
  'req.body.privateKey',
  'req.query.token',
  'req.params.token',
];

@Module({
  imports: [
    PlatformConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.getOrThrow<string>('app.nodeEnv');

        return {
          pinoHttp: {
            level: configService.getOrThrow<string>('app.logLevel'),
            redact: {
              paths: redactedPaths,
              censor: REDACTED,
            },
            genReqId: (request, response) => {
              const suppliedId = request.headers['x-request-id'];
              const candidate = Array.isArray(suppliedId)
                ? suppliedId[0]
                : suppliedId;
              const requestId =
                candidate && UUID_PATTERN.test(candidate)
                  ? candidate
                  : randomUUID();

              request.headers['x-request-id'] = requestId;
              response.setHeader('x-request-id', requestId);
              return requestId;
            },
            customProps: (request) => ({ requestId: request.id }),
            transport:
              nodeEnv === 'development'
                ? {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      singleLine: true,
                      translateTime: 'SYS:standard',
                      ignore: 'pid,hostname',
                    },
                  }
                : undefined,
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule {}
