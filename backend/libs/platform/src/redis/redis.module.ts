import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config';
import { RedisService } from './redis.service';

@Module({
  imports: [PlatformConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
