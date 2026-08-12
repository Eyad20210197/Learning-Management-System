import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ApiModule } from './api.module';
import { configureApi } from './bootstrap/configure-api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  configureApi(app, config);

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  // The structured logger may not exist when bootstrap itself fails.
  console.error('API bootstrap failed', error);
  process.exitCode = 1;
});
