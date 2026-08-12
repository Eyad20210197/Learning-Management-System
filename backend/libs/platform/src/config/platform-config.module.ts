import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { validateEnvironment } from './environment.validation';
import { queueConfig } from './queue.config';
import { processingConfig } from './processing.config';
import { redisConfig } from './redis.config';
import { storageConfig } from './storage.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        queueConfig,
        processingConfig,
        storageConfig,
      ],
      validate: validateEnvironment,
    }),
  ],
  exports: [ConfigModule],
})
export class PlatformConfigModule {}
