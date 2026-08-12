import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidUploadError,
  MediaResourceNotFoundError,
  UploadStateConflictError,
} from '../../domain';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../ports/media-repository.port';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../ports/object-storage.port';

const supportedResources = new Set([
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const maxResourceBytes = 100 * 1024 * 1024;

@Injectable()
export class InitiateLessonResourceUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly config: ConfigService,
  ) {}
  async execute(input: {
    lessonId: string;
    actorUserId: string;
    title: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    if (
      !supportedResources.has(input.mimeType) ||
      input.sizeBytes > maxResourceBytes
    ) {
      throw new InvalidUploadError(
        'The lesson resource type or size is not supported.',
      );
    }
    const storageKey = `resources/${input.lessonId}/${randomUUID()}`;
    const ttl = this.config.getOrThrow<number>('storage.uploadTtlSeconds');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const resource = await this.repository.createLessonResource({
      ...input,
      storageKey,
      expiresAt,
    });
    if (resource === null) throw new MediaResourceNotFoundError();
    return {
      id: resource.id,
      lessonId: resource.lessonId,
      title: resource.title,
      filename: resource.filename,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes.toString(),
      uploadUrl: await this.storage.createUploadUrl({
        key: storageKey,
        contentType: input.mimeType,
        contentLength: input.sizeBytes,
        expiresInSeconds: ttl,
      }),
      expiresAt,
    };
  }
}

@Injectable()
export class CompleteLessonResourceUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}
  async execute(id: string) {
    const resource = await this.repository.findLessonResource(id);
    if (resource === null) throw new MediaResourceNotFoundError();
    if (resource.status === 'READY') return resource;
    if (
      resource.status !== 'PENDING' ||
      resource.expiresAt === null ||
      resource.expiresAt <= new Date()
    ) {
      throw new UploadStateConflictError();
    }
    const object = await this.storage.head(resource.storageKey);
    if (
      object === null ||
      object.sizeBytes !== Number(resource.sizeBytes) ||
      object.contentType !== resource.mimeType
    ) {
      throw new InvalidUploadError(
        'The uploaded lesson resource does not match its authorization.',
      );
    }
    const completed = await this.repository.completeLessonResource(id);
    if (completed === null) throw new UploadStateConflictError();
    return completed;
  }
}

@Injectable()
export class GetLessonResourceDownloadUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}
  async execute(userId: string, id: string) {
    const resource = await this.repository.findAuthorizedLessonResource(
      userId,
      id,
      new Date(),
    );
    if (resource === null) throw new MediaResourceNotFoundError();
    return {
      id: resource.id,
      title: resource.title,
      filename: resource.filename,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes.toString(),
      downloadUrl: await this.storage.createDownloadUrl(
        resource.storageKey,
        300,
      ),
      expiresIn: 300,
    };
  }
}

@Injectable()
export class ExpireLessonResourcesUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}
  async execute(now = new Date()): Promise<number> {
    const expired = await this.repository.expireLessonResources(now);
    await Promise.all(
      expired.map(({ storageKey }) => this.storage.delete(storageKey)),
    );
    return expired.length;
  }
}
