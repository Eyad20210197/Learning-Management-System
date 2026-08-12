import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { VideoWorkerModule } from './video-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(
    VideoWorkerModule,
    { bufferLogs: true },
  );

  context.useLogger(context.get(Logger));
  context.enableShutdownHooks();
  context.get(Logger).log('Video worker is ready', 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  // The structured logger may not exist when bootstrap itself fails.
  console.error('Video worker bootstrap failed', error);
  process.exitCode = 1;
});
