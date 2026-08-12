import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type {
  GeneratedMediaFile,
  TranscodeResult,
  VideoTranscoderPort,
} from '../../application';
import { MediaCommandRunner } from './media-command.runner';

@Injectable()
export class FfmpegHlsAdapter implements VideoTranscoderPort {
  private readonly executable: string;

  constructor(
    config: ConfigService,
    private readonly runner: MediaCommandRunner,
  ) {
    this.executable =
      config.get<string>('processing.ffmpegPath') || ffmpegInstaller.path;
  }

  async transcode(
    input: Parameters<VideoTranscoderPort['transcode']>[0],
  ): Promise<TranscodeResult> {
    const variantLines: string[] = [];
    const variants: TranscodeResult['variants'] = [];
    for (const rendition of input.renditions) {
      const name = `${rendition.height}p`;
      const directory = join(input.outputPath, name);
      await mkdir(directory);
      const playlist = join(directory, 'index.m3u8');
      await this.runner.run(
        this.executable,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          input.sourcePath,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-profile:v',
          'main',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          `scale=${rendition.width}:${rendition.height}`,
          '-b:v',
          `${rendition.bitrateKbps}k`,
          '-maxrate',
          `${Math.round(rendition.bitrateKbps * 1.07)}k`,
          '-bufsize',
          `${rendition.bitrateKbps * 2}k`,
          '-sc_threshold',
          '0',
          '-force_key_frames',
          'expr:gte(t,n_forced*6)',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ac',
          '2',
          '-f',
          'hls',
          '-hls_time',
          '6',
          '-hls_playlist_type',
          'vod',
          '-hls_list_size',
          '0',
          '-hls_flags',
          'independent_segments+temp_file',
          '-hls_segment_filename',
          join(directory, 'segment-%05d.ts'),
          playlist,
        ],
        6 * 60 * 60 * 1_000,
      );
      const playlistRelativePath = this.relative(input.outputPath, playlist);
      variantLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${(rendition.bitrateKbps + 128) * 1_000},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"\n${playlistRelativePath}`,
      );
      variants.push({
        ...rendition,
        playlistRelativePath,
        sizeBytes: await this.directorySize(directory),
      });
    }

    const masterPlaylistRelativePath = 'master.m3u8';
    await writeFile(
      join(input.outputPath, masterPlaylistRelativePath),
      `#EXTM3U\n#EXT-X-VERSION:3\n${variantLines.join('\n')}\n`,
      'utf8',
    );
    const thumbnailRelativePath = 'thumbnail.jpg';
    await this.runner.run(
      this.executable,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        String(Math.min(Math.max(input.probe.durationSeconds * 0.1, 0), 30)),
        '-i',
        input.sourcePath,
        '-frames:v',
        '1',
        '-vf',
        'scale=min(1280\\,iw):-2',
        join(input.outputPath, thumbnailRelativePath),
      ],
      300_000,
    );
    return {
      masterPlaylistRelativePath,
      thumbnailRelativePath,
      files: await this.files(input.outputPath),
      variants,
    };
  }

  private async files(
    root: string,
    directory = root,
  ): Promise<GeneratedMediaFile[]> {
    const results: GeneratedMediaFile[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory())
        results.push(...(await this.files(root, absolutePath)));
      else if (entry.isFile()) {
        const relativePath = this.relative(root, absolutePath);
        results.push({
          absolutePath,
          relativePath,
          contentType: this.contentType(entry.name),
          sizeBytes: (await stat(absolutePath)).size,
          checksumSha256: await this.sha256(absolutePath),
        });
      }
    }
    return results;
  }

  private async sha256(path: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path))
      hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private async directorySize(path: string): Promise<number> {
    return (await this.files(path)).reduce(
      (total, file) => total + file.sizeBytes,
      0,
    );
  }

  private relative(root: string, path: string): string {
    return relative(root, path).split(sep).join('/');
  }

  private contentType(path: string): string {
    const name = basename(path).toLowerCase();
    if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (name.endsWith('.ts')) return 'video/mp2t';
    if (name.endsWith('.jpg')) return 'image/jpeg';
    return 'application/octet-stream';
  }
}
