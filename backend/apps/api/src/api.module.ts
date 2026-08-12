import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { IdentityModule } from '@lms/identity';
import { LearningModule } from '@lms/learning';
import { MediaModule } from '@lms/media';
import { OperationsModule } from '@lms/operations';
import { PlatformModule } from '@lms/platform';
import { GlobalExceptionFilter } from './core/http/filters/global-exception.filter';
import { RequestIdMiddleware } from './core/http/request-id/request-id.middleware';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PlatformModule,
    IdentityModule,
    LearningModule,
    MediaModule,
    OperationsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({
      path: '{*splat}',
      method: RequestMethod.ALL,
    });
  }
}
