import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { InvalidVideoSourceError, type VideoProbe } from '../../domain';
import type { MediaProbePort } from '../../application';
import { MediaCommandRunner } from './media-command.runner';

interface ProbeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
  }>;
  format?: { duration?: string };
}

@Injectable()
export class FfprobeAdapter implements MediaProbePort {
  private readonly executable: string;

  constructor(
    config: ConfigService,
    private readonly runner: MediaCommandRunner,
  ) {
    this.executable =
      config.get<string>('processing.ffprobePath') || ffprobeInstaller.path;
  }

  async inspect(sourcePath: string): Promise<VideoProbe> {
    let parsed: ProbeOutput;
    try {
      const output = await this.runner.run(
        this.executable,
        [
          '-v',
          'error',
          '-print_format',
          'json',
          '-show_format',
          '-show_streams',
          sourcePath,
        ],
        120_000,
      );
      parsed = JSON.parse(output) as ProbeOutput;
    } catch {
      throw new InvalidVideoSourceError(
        'FFprobe could not decode a valid video and audio stream from the uploaded source.',
      );
    }

    const video = parsed.streams?.find(
      (stream) => stream.codec_type === 'video',
    );
    const audio = parsed.streams?.find(
      (stream) => stream.codec_type === 'audio',
    );
    const duration = Number(parsed.format?.duration);
    if (
      video?.width === undefined ||
      video.height === undefined ||
      video.width < 2 ||
      video.height < 2 ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 43_200 ||
      audio === undefined
    ) {
      throw new InvalidVideoSourceError(
        'The source must contain valid video and audio streams and be no longer than 12 hours.',
      );
    }
    return {
      durationSeconds: Math.ceil(duration),
      width: video.width,
      height: video.height,
      videoCodec: video.codec_name ?? 'unknown',
      audioCodec: audio.codec_name ?? 'unknown',
    };
  }
}
