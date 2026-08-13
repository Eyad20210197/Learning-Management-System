import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  exports: [ScheduleModule],
})
export class PlatformSchedulingModule {}
