import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  CreateUploadInput,
  LessonResourceUploadView,
  MediaRepositoryPort,
} from '../../application';
import type { VideoUploadView, VideoView } from '../../domain';

@Injectable()
export class PrismaMediaRepository implements MediaRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createUpload(
    input: CreateUploadInput,
  ): Promise<VideoUploadView | null> {
    return this.prisma.$transaction(async (transaction) => {
      const lesson = await transaction.lesson.findFirst({
        where: { id: input.lessonId, type: 'VIDEO' },
        select: { id: true },
      });
      if (lesson === null) return null;
      const video = await transaction.video.create({
        data: {
          lessonId: input.lessonId,
          sourceFilename: input.filename,
          sourceSizeBytes: input.sizeBytes,
        },
      });
      return this.toUpload(
        await transaction.videoUpload.create({
          data: {
            videoId: video.id,
            initiatedByUserId: input.initiatedByUserId,
            storageKey: input.storageKey,
            providerUploadId: input.providerUploadId,
            expectedSizeBytes: input.sizeBytes,
            expiresAt: input.expiresAt,
          },
        }),
      );
    });
  }

  async findUpload(id: string): Promise<VideoUploadView | null> {
    const upload = await this.prisma.videoUpload.findUnique({ where: { id } });
    return upload && this.toUpload(upload);
  }

  async completeUpload(
    id: string,
    metadata: { mimeType: string; sizeBytes: number; checksumSha256?: string },
  ): Promise<VideoView | null> {
    return this.prisma.$transaction(async (transaction) => {
      const upload = await transaction.videoUpload.findFirst({
        where: { id, status: { in: ['PENDING', 'UPLOADING'] } },
      });
      if (upload === null) return null;
      await transaction.videoAsset.create({
        data: {
          videoId: upload.videoId,
          type: 'SOURCE',
          storageKey: upload.storageKey,
          mimeType: metadata.mimeType,
          sizeBytes: metadata.sizeBytes,
          checksumSha256: metadata.checksumSha256,
        },
      });
      await transaction.videoUpload.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await transaction.videoProcessingJob.create({
        data: { videoId: upload.videoId, status: 'QUEUED' },
      });
      return this.toVideo(
        await transaction.video.update({
          where: { id: upload.videoId },
          data: { status: 'QUEUED' },
        }),
      );
    });
  }

  async getVideo(id: string): Promise<VideoView | null> {
    const video = await this.prisma.video.findUnique({ where: { id } });
    return video && this.toVideo(video);
  }

  async expireUploads(now: Date): Promise<VideoUploadView[]> {
    return this.prisma.$transaction(async (transaction) => {
      const uploads = await transaction.videoUpload.findMany({
        where: {
          status: { in: ['PENDING', 'UPLOADING'] },
          expiresAt: { lte: now },
        },
      });
      if (uploads.length > 0) {
        await transaction.videoUpload.updateMany({
          where: { id: { in: uploads.map(({ id }) => id) } },
          data: { status: 'EXPIRED' },
        });
        await transaction.video.updateMany({
          where: { id: { in: uploads.map(({ videoId }) => videoId) } },
          data: { status: 'DELETED' },
        });
      }
      return uploads.map((upload) => this.toUpload(upload));
    });
  }

  async createLessonResource(input: {
    lessonId: string;
    actorUserId: string;
    title: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    expiresAt: Date;
  }): Promise<LessonResourceUploadView | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { id: true },
    });
    if (lesson === null) return null;
    return this.toResource(
      await this.prisma.lessonResource.create({
        data: {
          lessonId: input.lessonId,
          initiatedByUserId: input.actorUserId,
          title: input.title.trim(),
          filename: input.filename.trim(),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          expiresAt: input.expiresAt,
        },
      }),
    );
  }

  async findLessonResource(
    id: string,
  ): Promise<LessonResourceUploadView | null> {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id },
    });
    return resource && this.toResource(resource);
  }

  async completeLessonResource(
    id: string,
  ): Promise<LessonResourceUploadView | null> {
    const updated = await this.prisma.lessonResource.updateMany({
      where: { id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'READY', expiresAt: null },
    });
    if (updated.count === 0) return null;
    return this.toResource(
      await this.prisma.lessonResource.findUniqueOrThrow({ where: { id } }),
    );
  }

  async findAuthorizedLessonResource(
    userId: string,
    id: string,
    now: Date,
  ): Promise<LessonResourceUploadView | null> {
    const resource = await this.prisma.lessonResource.findFirst({
      where: {
        id,
        status: 'READY',
        lesson: {
          section: {
            course: {
              status: 'PUBLISHED',
              enrollments: {
                some: {
                  userId,
                  status: 'ACTIVE',
                  startsAt: { lte: now },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
              },
            },
          },
        },
      },
    });
    return resource && this.toResource(resource);
  }

  async expireLessonResources(now: Date): Promise<LessonResourceUploadView[]> {
    return this.prisma.$transaction(async (transaction) => {
      const resources = await transaction.lessonResource.findMany({
        where: { status: 'PENDING', expiresAt: { lte: now } },
      });
      await transaction.lessonResource.updateMany({
        where: { id: { in: resources.map(({ id }) => id) } },
        data: { status: 'EXPIRED' },
      });
      return resources.map((resource) => this.toResource(resource));
    });
  }

  private toUpload(record: {
    id: string;
    videoId: string;
    status: VideoUploadView['status'];
    storageKey: string;
    providerUploadId: string | null;
    expectedSizeBytes: bigint;
    expiresAt: Date;
  }): VideoUploadView {
    return record;
  }

  private toVideo(record: {
    id: string;
    lessonId: string;
    status: VideoView['status'];
    sourceFilename: string;
    sourceSizeBytes: bigint;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    isCurrent: boolean;
    processingError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VideoView {
    return { ...record, sourceSizeBytes: record.sourceSizeBytes.toString() };
  }

  private toResource(
    record: LessonResourceUploadView,
  ): LessonResourceUploadView {
    return record;
  }
}
