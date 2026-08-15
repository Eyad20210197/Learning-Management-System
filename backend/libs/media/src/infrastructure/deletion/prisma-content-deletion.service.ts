import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@lms/platform';
import { OBJECT_STORAGE, type ObjectStoragePort } from '../../application';

interface StorageCleanup {
  keys: string[];
  videoIds: string[];
}

@Injectable()
export class PrismaContentDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async listResources() {
    const resources = await this.prisma.lessonResource.findMany({
      include: {
        lesson: {
          select: {
            title: true,
            section: {
              select: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return resources.map((resource) => ({
      id: resource.id,
      lessonId: resource.lessonId,
      lessonTitle: resource.lesson.title,
      courseId: resource.lesson.section.course.id,
      courseTitle: resource.lesson.section.course.title,
      title: resource.title,
      filename: resource.filename,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes.toString(),
      status: resource.status,
      createdAt: resource.createdAt.toISOString(),
    }));
  }

  async deleteResource(id: string): Promise<void> {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id },
    });
    if (resource === null)
      throw new NotFoundException('Lesson resource not found.');
    await this.prisma.lessonResource.delete({ where: { id } });
    await this.storage.delete(resource.storageKey);
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { uploads: true, assets: true },
    });
    if (video === null) throw new NotFoundException('Video not found.');
    await this.prisma.$transaction((transaction) =>
      this.deleteVideos(transaction, [id]),
    );
    await this.cleanupStorage({
      keys: [
        ...video.uploads.map(({ storageKey }) => storageKey),
        ...video.assets.map(({ storageKey }) => storageKey),
      ],
      videoIds: [id],
    });
  }

  async deleteLesson(id: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        resources: true,
        videos: { include: { uploads: true, assets: true } },
      },
    });
    if (lesson === null) throw new NotFoundException('Lesson not found.');
    await this.prisma.$transaction(async (transaction) => {
      await this.deleteVideos(
        transaction,
        lesson.videos.map(({ id: videoId }) => videoId),
      );
      await transaction.lessonResource.deleteMany({ where: { lessonId: id } });
      await transaction.lessonProgress.deleteMany({ where: { lessonId: id } });
      await transaction.lesson.delete({ where: { id } });
    });
    await this.cleanupStorage(this.lessonCleanup(lesson));
  }

  async deleteSection(id: string): Promise<void> {
    const section = await this.prisma.courseSection.findUnique({
      where: { id },
      include: {
        lessons: {
          include: {
            resources: true,
            videos: { include: { uploads: true, assets: true } },
          },
        },
      },
    });
    if (section === null) throw new NotFoundException('Section not found.');
    const lessonIds = section.lessons.map(({ id: lessonId }) => lessonId);
    const videoIds = section.lessons.flatMap(({ videos }) =>
      videos.map(({ id: videoId }) => videoId),
    );
    await this.prisma.$transaction(async (transaction) => {
      await this.deleteVideos(transaction, videoIds);
      await transaction.lessonResource.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      await transaction.lessonProgress.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      await transaction.lesson.deleteMany({ where: { id: { in: lessonIds } } });
      await transaction.courseSection.delete({ where: { id } });
    });
    await this.cleanupStorage({
      keys: section.lessons.flatMap(
        (lesson) => this.lessonCleanup(lesson).keys,
      ),
      videoIds,
    });
  }

  private async deleteVideos(
    transaction: Prisma.TransactionClient,
    videoIds: string[],
  ): Promise<void> {
    if (videoIds.length === 0) return;
    await transaction.playbackEvent.deleteMany({
      where: { playbackSession: { videoId: { in: videoIds } } },
    });
    await transaction.playbackSession.deleteMany({
      where: { videoId: { in: videoIds } },
    });
    await transaction.videoProcessingJob.deleteMany({
      where: { videoId: { in: videoIds } },
    });
    await transaction.videoVariant.deleteMany({
      where: { videoId: { in: videoIds } },
    });
    await transaction.videoAsset.deleteMany({
      where: { videoId: { in: videoIds } },
    });
    await transaction.videoUpload.deleteMany({
      where: { videoId: { in: videoIds } },
    });
    await transaction.video.deleteMany({ where: { id: { in: videoIds } } });
  }

  private lessonCleanup(lesson: {
    resources: Array<{ storageKey: string }>;
    videos: Array<{
      id: string;
      uploads: Array<{ storageKey: string }>;
      assets: Array<{ storageKey: string }>;
    }>;
  }): StorageCleanup {
    return {
      keys: [
        ...lesson.resources.map(({ storageKey }) => storageKey),
        ...lesson.videos.flatMap(({ uploads }) =>
          uploads.map(({ storageKey }) => storageKey),
        ),
        ...lesson.videos.flatMap(({ assets }) =>
          assets.map(({ storageKey }) => storageKey),
        ),
      ],
      videoIds: lesson.videos.map(({ id }) => id),
    };
  }

  private async cleanupStorage(cleanup: StorageCleanup): Promise<void> {
    await Promise.all(
      [...new Set(cleanup.keys)].map((key) => this.storage.delete(key)),
    );
    if (this.storage.deletePrefix) {
      await Promise.all(
        cleanup.videoIds.map((videoId) =>
          this.storage.deletePrefix!(`processed/${videoId}/`),
        ),
      );
    }
  }
}
