import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { InvalidVideoSourceError, ProcessVideoUseCase } from '@lms/media';
import { VIDEO_PROCESSING_QUEUE } from '@lms/platform';

export interface VideoProcessingJobData {
  videoId: string;
  processingJobId: string;
}

@Processor(VIDEO_PROCESSING_QUEUE, { concurrency: 1 })
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(private readonly processVideo: ProcessVideoUseCase) {
    super();
  }

  async process(
    job: Job<VideoProcessingJobData>,
  ): Promise<{ videoId: string }> {
    if (job.name !== 'transcode-video') {
      throw new UnrecoverableError(`Unsupported video job: ${job.name}`);
    }
    const attempt = job.attemptsMade + 1;
    const maximumAttempts = job.opts.attempts ?? 1;
    this.logger.log({
      message: 'Video processing started',
      videoId: job.data.videoId,
      processingJobId: job.data.processingJobId,
      attempt,
      maximumAttempts,
    });
    try {
      await this.processVideo.execute({
        ...job.data,
        queueJobId: String(job.id),
        attempt,
        maximumAttempts,
      });
      this.logger.log({
        message: 'Video processing succeeded',
        videoId: job.data.videoId,
        processingJobId: job.data.processingJobId,
      });
      return { videoId: job.data.videoId };
    } catch (error: unknown) {
      this.logger.error({
        message: 'Video processing failed',
        videoId: job.data.videoId,
        processingJobId: job.data.processingJobId,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      if (error instanceof InvalidVideoSourceError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn({ message: 'Video processing job stalled', jobId });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<VideoProcessingJobData> | undefined, error: Error): void {
    this.logger.error({
      message: 'Video processing job exhausted an attempt',
      queueJobId: job?.id,
      videoId: job?.data.videoId,
      processingJobId: job?.data.processingJobId,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  }
}
