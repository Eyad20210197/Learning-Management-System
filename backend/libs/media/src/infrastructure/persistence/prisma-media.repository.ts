import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  CreateUploadInput,
  LessonResourceUploadView,
  MediaRepositoryPort,
  ProcessedAssetRecord,
  ProcessedVariantRecord,
} from '../../application';
import type {
  VideoDetailsView,
  VideoProbe,
  VideoProcessingJobView,
  VideoSourceView,
  VideoUploadView,
  VideoVariantView,
  VideoView,
} from '../../domain';

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
  ): Promise<{ video: VideoView; processingJobId: string } | null> {
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
      const processingJob = await transaction.videoProcessingJob.create({
        data: { videoId: upload.videoId, status: 'QUEUED' },
      });
      return {
        video: this.toVideo(
          await transaction.video.update({
            where: { id: upload.videoId },
            data: { status: 'QUEUED' },
          }),
        ),
        processingJobId: processingJob.id,
      };
    });
  }

  async getQueueableProcessingJob(
    videoId: string,
  ): Promise<VideoProcessingJobView | null> {
    const record = await this.prisma.videoProcessingJob.findFirst({
      where: { videoId, status: 'QUEUED' },
      orderBy: { createdAt: 'desc' },
    });
    return record && this.toProcessingJob(record);
  }

  async getVideoDetails(id: string): Promise<VideoDetailsView | null> {
    const record = await this.prisma.video.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { height: 'asc' } },
        processingJobs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (record === null) return null;
    return {
      ...this.toVideo(record),
      variants: record.variants.map((variant) => this.toVariant(variant)),
      processingJobs: record.processingJobs.map((job) =>
        this.toProcessingJob(job),
      ),
    };
  }

  async claimProcessing(input: {
    processingJobId: string;
    queueJobId: string;
    attempt: number;
  }): Promise<VideoSourceView | null> {
    return this.prisma.$transaction(async (transaction) => {
      const job = await transaction.videoProcessingJob.findFirst({
        where: {
          id: input.processingJobId,
          status: { in: ['QUEUED', 'ACTIVE'] },
        },
        include: {
          video: {
            include: {
              assets: { where: { type: 'SOURCE' }, take: 1 },
            },
          },
        },
      });
      const source = job?.video.assets[0];
      if (job === null || source === undefined) return null;

      const updatedJob = await transaction.videoProcessingJob.update({
        where: { id: job.id },
        data: {
          queueJobId: input.queueJobId,
          status: 'ACTIVE',
          attempt: input.attempt,
          startedAt: new Date(),
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      const video = await transaction.video.update({
        where: { id: job.videoId },
        data: { status: 'PROCESSING', processingError: null },
      });
      return {
        video: this.toVideo(video),
        processingJob: this.toProcessingJob(updatedJob),
        storageKey: source.storageKey,
        mimeType: source.mimeType,
      };
    });
  }

  async markProcessingSucceeded(input: {
    processingJobId: string;
    probe: VideoProbe;
    masterAsset: ProcessedAssetRecord;
    thumbnailAsset: ProcessedAssetRecord;
    variants: ProcessedVariantRecord[];
  }): Promise<VideoView | null> {
    return this.prisma.$transaction(async (transaction) => {
      const job = await transaction.videoProcessingJob.findFirst({
        where: { id: input.processingJobId, status: 'ACTIVE' },
      });
      if (job === null) return null;

      await transaction.videoAsset.deleteMany({
        where: {
          videoId: job.videoId,
          type: { in: ['HLS_MASTER', 'THUMBNAIL'] },
        },
      });
      await transaction.videoVariant.deleteMany({
        where: { videoId: job.videoId },
      });
      await transaction.videoAsset.createMany({
        data: [
          {
            videoId: job.videoId,
            type: 'HLS_MASTER',
            ...input.masterAsset,
          },
          {
            videoId: job.videoId,
            type: 'THUMBNAIL',
            ...input.thumbnailAsset,
          },
        ],
      });
      await transaction.videoVariant.createMany({
        data: input.variants.map((variant) => ({
          videoId: job.videoId,
          status: 'READY' as const,
          width: variant.width,
          height: variant.height,
          bitrateKbps: variant.bitrateKbps,
          videoCodec: variant.videoCodec,
          audioCodec: variant.audioCodec,
          playlistKey: variant.playlistKey,
          sizeBytes: BigInt(variant.sizeBytes),
        })),
      });
      await transaction.videoProcessingJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', finishedAt: new Date() },
      });
      return this.toVideo(
        await transaction.video.update({
          where: { id: job.videoId },
          data: {
            status: 'READY',
            durationSeconds: input.probe.durationSeconds,
            width: input.probe.width,
            height: input.probe.height,
            videoCodec: input.probe.videoCodec,
            audioCodec: input.probe.audioCodec,
            processingError: null,
          },
        }),
      );
    });
  }

  async markProcessingFailed(input: {
    processingJobId: string;
    attempt: number;
    errorCode: string;
    errorMessage: string;
    terminal: boolean;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const job = await transaction.videoProcessingJob.findUnique({
        where: { id: input.processingJobId },
      });
      if (job === null || job.status === 'SUCCEEDED') return;
      await transaction.videoProcessingJob.update({
        where: { id: job.id },
        data: {
          status: input.terminal ? 'FAILED' : 'QUEUED',
          attempt: input.attempt,
          finishedAt: input.terminal ? new Date() : null,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        },
      });
      await transaction.video.update({
        where: { id: job.videoId },
        data: {
          status: input.terminal ? 'FAILED' : 'QUEUED',
          processingError: input.errorMessage,
        },
      });
    });
  }

  async retryProcessing(videoId: string): Promise<{
    video: VideoView;
    processingJob: VideoProcessingJobView;
  } | null> {
    return this.prisma.$transaction(async (transaction) => {
      const video = await transaction.video.findFirst({
        where: { id: videoId, status: 'FAILED' },
      });
      if (video === null) return null;
      const processingJob = await transaction.videoProcessingJob.create({
        data: { videoId, status: 'QUEUED' },
      });
      const updatedVideo = await transaction.video.update({
        where: { id: videoId },
        data: { status: 'QUEUED', processingError: null },
      });
      return {
        video: this.toVideo(updatedVideo),
        processingJob: this.toProcessingJob(processingJob),
      };
    });
  }

  async activateVideo(
    lessonId: string,
    videoId: string,
  ): Promise<VideoView | null> {
    return this.prisma.$transaction(async (transaction) => {
      const video = await transaction.video.findFirst({
        where: { id: videoId, lessonId, status: 'READY' },
      });
      if (video === null) return null;
      await transaction.video.updateMany({
        where: { lessonId, isCurrent: true, id: { not: videoId } },
        data: { isCurrent: false },
      });
      return this.toVideo(
        await transaction.video.update({
          where: { id: videoId },
          data: { isCurrent: true },
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

  private toVariant(record: {
    id: string;
    status: VideoVariantView['status'];
    width: number;
    height: number;
    bitrateKbps: number;
    videoCodec: string;
    audioCodec: string;
    sizeBytes: bigint | null;
  }): VideoVariantView {
    return {
      ...record,
      sizeBytes: record.sizeBytes?.toString() ?? null,
    };
  }

  private toProcessingJob(record: {
    id: string;
    videoId: string;
    queueJobId: string | null;
    status: VideoProcessingJobView['status'];
    attempt: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VideoProcessingJobView {
    return record;
  }

  private toResource(
    record: LessonResourceUploadView,
  ): LessonResourceUploadView {
    return record;
  }
}
