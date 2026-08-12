import { registerAs } from '@nestjs/config';

export interface ProcessingConfig {
  ffmpegPath: string;
  ffprobePath: string;
}

export const processingConfig = registerAs(
  'processing',
  (): ProcessingConfig => ({
    ffmpegPath: process.env.FFMPEG_PATH?.trim() ?? '',
    ffprobePath: process.env.FFPROBE_PATH?.trim() ?? '',
  }),
);
