import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { VIDEO_PROCESSING_QUEUE } from '@lms/platform';
import {
  InvalidUploadError,
  MediaResourceNotFoundError,
  UploadStateConflictError,
  type VideoView,
} from '../../domain';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../ports/media-repository.port';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../ports/object-storage.port';

const supportedMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
]);
const multipartThresholdBytes = 100 * 1024 * 1024;
export const multipartPartSizeBytes = 16 * 1024 * 1024;

export interface InitiateUploadInput {
  lessonId: string;
  actorUserId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class InitiateVideoUploadUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: InitiateUploadInput) {
    this.validate(input);
    const extension = this.safeExtension(input.filename);
    const storageKey = `sources/${input.lessonId}/${randomUUID()}${extension}`;
    const ttl = this.config.getOrThrow<number>('storage.uploadTtlSeconds');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const multipart = input.sizeBytes > multipartThresholdBytes;
    const providerUploadId = multipart
      ? await this.storage.createMultipartUpload({
          key: storageKey,
          contentType: input.mimeType,
        })
      : undefined;
    const upload = await this.repository.createUpload({
      lessonId: input.lessonId,
      initiatedByUserId: input.actorUserId,
      filename: input.filename.trim(),
      sizeBytes: input.sizeBytes,
      storageKey,
      providerUploadId,
      expiresAt,
    });
    if (upload === null) {
      if (providerUploadId) {
        await this.storage.abortMultipartUpload(storageKey, providerUploadId);
      }
      throw new MediaResourceNotFoundError();
    }
    try {
      const uploadUrl = multipart
        ? null
        : await this.storage.createUploadUrl({
            key: storageKey,
            contentType: input.mimeType,
            contentLength: input.sizeBytes,
            expiresInSeconds: ttl,
          });
      return {
        id: upload.id,
        videoId: upload.videoId,
        status: upload.status,
        uploadUrl,
        uploadMode: multipart ? ('MULTIPART' as const) : ('SINGLE' as const),
        partSizeBytes: multipart ? multipartPartSizeBytes : null,
        expiresAt,
      };
    } catch (error: unknown) {
      await (
        providerUploadId
          ? this.storage.abortMultipartUpload(storageKey, providerUploadId)
          : this.storage.delete(storageKey)
      ).catch(() => undefined);
      throw error;
    }
  }

  private validate(input: InitiateUploadInput): void {
    if (!supportedMimeTypes.has(input.mimeType)) {
      throw new InvalidUploadError('The video MIME type is not supported.');
    }
    const maximum = this.config.getOrThrow<number>('storage.maxVideoBytes');
    if (input.sizeBytes <= 0 || input.sizeBytes > maximum) {
      throw new InvalidUploadError(
        `Video size must be between 1 and ${maximum} bytes.`,
      );
    }
  }

  private safeExtension(filename: string): string {
    const match = /\.(mp4|mov|mkv)$/i.exec(filename.trim());
    if (!match)
      throw new InvalidUploadError(
        'The video filename extension is not supported.',
      );
    return `.${match[1]!.toLowerCase()}`;
  }
}

@Injectable()
export class CreateMultipartPartUrlUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly config: ConfigService,
  ) {}

  async execute(
    uploadId: string,
    partNumber: number,
  ): Promise<{ uploadUrl: string }> {
    if (partNumber < 1 || partNumber > 10_000) {
      throw new InvalidUploadError('Part number must be between 1 and 10000.');
    }
    const upload = await this.repository.findUpload(uploadId);
    if (upload === null) throw new MediaResourceNotFoundError();
    if (!upload.providerUploadId || upload.expiresAt <= new Date()) {
      throw new UploadStateConflictError('The multipart upload is not active.');
    }
    return {
      uploadUrl: await this.storage.createMultipartPartUrl({
        key: upload.storageKey,
        uploadId: upload.providerUploadId,
        partNumber,
        expiresInSeconds: this.config.getOrThrow<number>(
          'storage.uploadTtlSeconds',
        ),
      }),
    };
  }
}

@Injectable()
export class CompleteVideoUploadUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly queue: Queue,
  ) {}

  async execute(uploadId: string): Promise<VideoView> {
    const upload = await this.repository.findUpload(uploadId);
    if (upload === null) throw new MediaResourceNotFoundError();
    if (upload.status === 'COMPLETED') {
      const video = await this.repository.getVideo(upload.videoId);
      if (video === null) throw new MediaResourceNotFoundError();
      const processingJob = await this.repository.getQueueableProcessingJob(
        video.id,
      );
      if (processingJob !== null) {
        await this.enqueue(video.id, processingJob.id);
      }
      return video;
    }
    if (upload.status !== 'PENDING' && upload.status !== 'UPLOADING') {
      throw new UploadStateConflictError();
    }
    if (upload.expiresAt <= new Date()) {
      throw new UploadStateConflictError(
        'The upload authorization has expired.',
      );
    }
    const object = await this.storage.head(upload.storageKey);
    if (object === null)
      throw new InvalidUploadError('The uploaded object was not found.');
    if (object.sizeBytes !== Number(upload.expectedSizeBytes)) {
      throw new InvalidUploadError(
        'The uploaded object size does not match the authorization.',
      );
    }
    if (
      object.contentType === undefined ||
      !supportedMimeTypes.has(object.contentType)
    ) {
      throw new InvalidUploadError(
        'The uploaded object content type is invalid.',
      );
    }
    const completed = await this.repository.completeUpload(uploadId, {
      mimeType: object.contentType,
      sizeBytes: object.sizeBytes,
      checksumSha256: object.checksumSha256,
    });
    if (completed === null) throw new UploadStateConflictError();
    await this.enqueue(completed.video.id, completed.processingJobId);
    return completed.video;
  }

  private async enqueue(
    videoId: string,
    processingJobId: string,
  ): Promise<void> {
    await this.queue.add(
      'transcode-video',
      { videoId, processingJobId },
      { jobId: `processing-${processingJobId}` },
    );
  }
}

@Injectable()
export class CompleteMultipartUploadUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly completeUpload: CompleteVideoUploadUseCase,
  ) {}

  async execute(
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<VideoView> {
    const upload = await this.repository.findUpload(uploadId);
    if (upload === null) throw new MediaResourceNotFoundError();
    if (!upload.providerUploadId || upload.expiresAt <= new Date()) {
      throw new UploadStateConflictError('The multipart upload is not active.');
    }
    if (
      parts.length === 0 ||
      new Set(parts.map(({ partNumber }) => partNumber)).size !== parts.length
    ) {
      throw new InvalidUploadError(
        'Multipart completion requires unique uploaded parts.',
      );
    }
    if ((await this.storage.head(upload.storageKey)) === null) {
      await this.storage.completeMultipartUpload({
        key: upload.storageKey,
        uploadId: upload.providerUploadId,
        parts: [...parts].sort(
          (left, right) => left.partNumber - right.partNumber,
        ),
      });
    }
    return this.completeUpload.execute(uploadId);
  }
}

@Injectable()
export class GetVideoUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
  ) {}
  async execute(id: string): Promise<VideoView> {
    const video = await this.repository.getVideo(id);
    if (video === null) throw new MediaResourceNotFoundError();
    return video;
  }
}

@Injectable()
export class ExpireVideoUploadsUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}
  async execute(now = new Date()): Promise<number> {
    const expired = await this.repository.expireUploads(now);
    await Promise.all(
      expired.map((upload) =>
        upload.providerUploadId
          ? this.storage.abortMultipartUpload(
              upload.storageKey,
              upload.providerUploadId,
            )
          : this.storage.delete(upload.storageKey),
      ),
    );
    return expired.length;
  }
}
