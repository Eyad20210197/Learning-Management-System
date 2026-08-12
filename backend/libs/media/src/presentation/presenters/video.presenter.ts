import type { VideoView } from '../../domain';

export class VideoPresenter {
  static video(video: VideoView): Record<string, unknown> {
    return {
      ...video,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
    };
  }
}
