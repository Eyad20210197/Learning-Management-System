import { Module } from '@nestjs/common';
import { MediaModule } from '@lms/media';
import { PlatformModule } from '@lms/platform';
import { VideoProcessingProcessor } from './video-processing.processor';

@Module({
  imports: [PlatformModule, MediaModule],
  providers: [VideoProcessingProcessor],
})
export class VideoWorkerModule {}
