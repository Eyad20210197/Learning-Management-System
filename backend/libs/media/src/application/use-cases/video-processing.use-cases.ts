import { extname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '@lms/platform';
import {
  InvalidVideoSourceError,
  MediaResourceNotFoundError,
  VideoProcessingConflictError,
  selectVideoRenditions,
  type VideoDetailsView,
  type VideoView,
} from '../../domain';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
  type ProcessedAssetRecord,
  type ProcessedVariantRecord,
} from '../ports/media-repository.port';
import {
  MEDIA_PROBE,
  TEMPORARY_WORKSPACE,
  VIDEO_TRANSCODER,
  type MediaProbePort,
  type TemporaryWorkspacePort,
  type VideoTranscoderPort,
} from '../ports/video-processing.port';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../ports/object-storage.port';

export interface ProcessVideoInput {
  videoId: string;
  processingJobId: string;
  queueJobId: string;
  attempt: number;
  maximumAttempts: number;
}

@Injectable()
export class ProcessVideoUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(TEMPORARY_WORKSPACE)
    private readonly workspace: TemporaryWorkspacePort,
    @Inject(MEDIA_PROBE) private readonly probe: MediaProbePort,
    @Inject(VIDEO_TRANSCODER) private readonly transcoder: VideoTranscoderPort,
  ) {}

  async execute(input: ProcessVideoInput): Promise<VideoView> {
    const source = await this.repository.claimProcessing(input);
    if (source === null || source.video.id !== input.videoId) {
      throw new VideoProcessingConflictError(
        'The processing job is no longer claimable.',
      );
    }
    const workspace = await this.workspace.create(
      this.sourceExtension(source.video.sourceFilename),
    );
    const uploadedKeys: string[] = [];
    try {
      await this.storage.downloadToFile(
        source.storageKey,
        workspace.sourcePath,
      );
      const probe = await this.probe.inspect(workspace.sourcePath);
      const output = await this.transcoder.transcode({
        sourcePath: workspace.sourcePath,
        outputPath: workspace.outputPath,
        probe,
        renditions: selectVideoRenditions(probe.width, probe.height),
      });
      const prefix = `processed/${input.videoId}/${input.processingJobId}`;
      for (const file of output.files) {
        const key = `${prefix}/${file.relativePath}`;
        await this.storage.uploadFile({
          key,
          sourcePath: file.absolutePath,
          contentType: file.contentType,
          checksumSha256: file.checksumSha256,
        });
        uploadedKeys.push(key);
        const stored = await this.storage.head(key);
        if (
          stored === null ||
          stored.sizeBytes !== file.sizeBytes ||
          stored.checksumSha256 !== file.checksumSha256
        ) {
          throw new Error(
            `Processed asset verification failed for ${file.relativePath}`,
          );
        }
      }
      const fileByPath = new Map(
        output.files.map((file) => [file.relativePath, file]),
      );
      const master = this.asset(
        prefix,
        output.masterPlaylistRelativePath,
        fileByPath,
      );
      const thumbnail = this.asset(
        prefix,
        output.thumbnailRelativePath,
        fileByPath,
      );
      const variants: ProcessedVariantRecord[] = output.variants.map(
        (variant) => ({
          id: '',
          status: 'READY',
          width: variant.width,
          height: variant.height,
          bitrateKbps: variant.bitrateKbps,
          videoCodec: 'h264',
          audioCodec: 'aac',
          playlistKey: `${prefix}/${variant.playlistRelativePath}`,
          sizeBytes: String(variant.sizeBytes),
        }),
      );
      const video = await this.repository.markProcessingSucceeded({
        processingJobId: input.processingJobId,
        probe,
        masterAsset: master,
        thumbnailAsset: thumbnail,
        variants,
      });
      if (video === null) throw new VideoProcessingConflictError();
      return video;
    } catch (error: unknown) {
      await Promise.allSettled(
        uploadedKeys.map((key) => this.storage.delete(key)),
      );
      const terminal =
        error instanceof InvalidVideoSourceError ||
        input.attempt >= input.maximumAttempts;
      await this.repository.markProcessingFailed({
        processingJobId: input.processingJobId,
        attempt: input.attempt,
        errorCode: this.code(error),
        errorMessage: this.message(error),
        terminal,
      });
      throw error;
    } finally {
      await this.workspace.remove(workspace.rootPath);
    }
  }

  private asset(
    prefix: string,
    relativePath: string,
    files: Map<
      string,
      { contentType: string; sizeBytes: number; checksumSha256: string }
    >,
  ): ProcessedAssetRecord {
    const file = files.get(relativePath);
    if (file === undefined)
      throw new Error(`Generated asset is missing: ${relativePath}`);
    return {
      storageKey: `${prefix}/${relativePath}`,
      mimeType: file.contentType,
      sizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256,
    };
  }

  private sourceExtension(filename: string): string {
    const extension = extname(filename).toLowerCase();
    return ['.mp4', '.mov', '.mkv'].includes(extension) ? extension : '.video';
  }

  private code(error: unknown): string {
    if (error instanceof InvalidVideoSourceError) return error.code;
    if (error instanceof VideoProcessingConflictError) return error.code;
    return 'VIDEO_PROCESSING_FAILED';
  }

  private message(error: unknown): string {
    if (error instanceof InvalidVideoSourceError)
      return error.message.slice(0, 4_000);
    if (error instanceof VideoProcessingConflictError)
      return error.message.slice(0, 4_000);
    return 'Video processing failed. Retry the operation or inspect the worker logs.';
  }
}

@Injectable()
export class GetVideoDetailsUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
  ) {}
  async execute(videoId: string): Promise<VideoDetailsView> {
    const video = await this.repository.getVideoDetails(videoId);
    if (video === null) throw new MediaResourceNotFoundError();
    return video;
  }
}

@Injectable()
export class RetryVideoProcessingUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly queue: Queue,
  ) {}
  async execute(videoId: string): Promise<VideoView> {
    const retry = await this.repository.retryProcessing(videoId);
    if (retry === null)
      throw new VideoProcessingConflictError(
        'Only failed videos can be retried.',
      );
    await this.queue.add(
      'transcode-video',
      { videoId, processingJobId: retry.processingJob.id },
      { jobId: `processing-${retry.processingJob.id}` },
    );
    return retry.video;
  }
}

@Injectable()
export class ActivateVideoUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
  ) {}
  async execute(lessonId: string, videoId: string): Promise<VideoView> {
    const video = await this.repository.activateVideo(lessonId, videoId);
    if (video === null)
      throw new VideoProcessingConflictError(
        'Only a ready video for this lesson can be activated.',
      );
    return video;
  }
}
