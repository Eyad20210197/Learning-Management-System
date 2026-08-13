import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export function configureApi(
  app: INestApplication,
  config: ConfigService,
): void {
  const express = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
  };
  // Nginx is the sole public ingress in production. Trusting exactly one hop
  // preserves the original protocol/IP without accepting arbitrary forwarded
  // headers directly from clients.
  express.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string[]>('app.corsOrigins'),
    credentials: true,
  });
  app.enableShutdownHooks();

  if (config.getOrThrow<boolean>('app.apiDocsEnabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LMS API')
      .setDescription('LMS backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/openapi.json',
    });
  }
}
