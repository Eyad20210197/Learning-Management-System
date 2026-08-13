import { Module } from '@nestjs/common';
import { MediaModule } from '@lms/media';
import { PlatformModule } from '@lms/platform';
import { VideoProcessingProcessor } from './video-processing.processor';
import { MediaToolchainVerifier } from './media-toolchain-verifier.service';

@Module({
  imports: [PlatformModule, MediaModule],
  providers: [VideoProcessingProcessor, MediaToolchainVerifier],
})
export class VideoWorkerModule {}
