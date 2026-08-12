import type { VideoDetailsView, VideoView } from '../../domain';

export class VideoPresenter {
  static video(video: VideoView): Record<string, unknown> {
    return {
      id: video.id,
      lessonId: video.lessonId,
      status: video.status,
      sourceFilename: video.sourceFilename,
      sourceSizeBytes: video.sourceSizeBytes,
      durationSeconds: video.durationSeconds,
      width: video.width,
      height: video.height,
      isCurrent: video.isCurrent,
      processingError: video.processingError,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
    };
  }

  static details(video: VideoDetailsView): Record<string, unknown> {
    return {
      ...this.video(video),
      variants: video.variants.map((variant) => ({
        id: variant.id,
        status: variant.status,
        width: variant.width,
        height: variant.height,
        bitrateKbps: variant.bitrateKbps,
        videoCodec: variant.videoCodec,
        audioCodec: variant.audioCodec,
        sizeBytes: variant.sizeBytes,
      })),
      processingJobs: video.processingJobs.map((job) => ({
        id: job.id,
        videoId: job.videoId,
        queueJobId: job.queueJobId,
        status: job.status,
        attempt: job.attempt,
        startedAt: job.startedAt?.toISOString() ?? null,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    };
  }
}
