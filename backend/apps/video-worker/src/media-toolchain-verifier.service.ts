import { spawn } from 'node:child_process';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

@Injectable()
export class MediaToolchainVerifier implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaToolchainVerifier.name);

  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const ffmpeg =
      this.config.get<string>('processing.ffmpegPath') || ffmpegInstaller.path;
    const ffprobe =
      this.config.get<string>('processing.ffprobePath') ||
      ffprobeInstaller.path;
    await Promise.all([
      this.verify(ffmpeg, 'FFmpeg'),
      this.verify(ffprobe, 'FFprobe'),
    ]);
    this.logger.log('FFmpeg and FFprobe startup verification passed');
  }

  private verify(executable: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, ['-version'], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let standardError = '';
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`${name} startup verification timed out`));
      }, 10_000);
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        standardError += chunk;
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`${name} could not start: ${error.message}`));
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `${name} startup verification failed with exit code ${code}: ${standardError.trim()}`,
            ),
          );
      });
    });
  }
}
