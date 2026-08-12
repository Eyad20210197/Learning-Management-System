import type { VideoUploadView, VideoView } from '../../domain';

export interface CreateUploadInput {
  lessonId: string;
  initiatedByUserId: string;
  filename: string;
  sizeBytes: number;
  storageKey: string;
  providerUploadId?: string;
  expiresAt: Date;
}

export interface MediaRepositoryPort {
  createUpload(input: CreateUploadInput): Promise<VideoUploadView | null>;
  findUpload(id: string): Promise<VideoUploadView | null>;
  completeUpload(
    id: string,
    metadata: { mimeType: string; sizeBytes: number; checksumSha256?: string },
  ): Promise<VideoView | null>;
  getVideo(id: string): Promise<VideoView | null>;
  expireUploads(now: Date): Promise<VideoUploadView[]>;
  createLessonResource(input: {
    lessonId: string;
    actorUserId: string;
    title: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    expiresAt: Date;
  }): Promise<LessonResourceUploadView | null>;
  findLessonResource(id: string): Promise<LessonResourceUploadView | null>;
  completeLessonResource(id: string): Promise<LessonResourceUploadView | null>;
  findAuthorizedLessonResource(
    userId: string,
    id: string,
    now: Date,
  ): Promise<LessonResourceUploadView | null>;
  expireLessonResources(now: Date): Promise<LessonResourceUploadView[]>;
}

export interface LessonResourceUploadView {
  id: string;
  lessonId: string;
  title: string;
  filename: string;
  status: 'PENDING' | 'READY' | 'EXPIRED';
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
  expiresAt: Date | null;
  createdAt: Date;
}

export const MEDIA_REPOSITORY = Symbol('media.repository');
