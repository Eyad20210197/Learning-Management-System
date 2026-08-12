import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config';
import { PrismaService } from './prisma.service';

@Module({
  imports: [PlatformConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
