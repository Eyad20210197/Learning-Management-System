import { Module } from '@nestjs/common';
import { MediaModule } from '@lms/media';
import { PlatformModule } from '@lms/platform';

@Module({
  imports: [PlatformModule, MediaModule],
})
export class VideoWorkerModule {}
