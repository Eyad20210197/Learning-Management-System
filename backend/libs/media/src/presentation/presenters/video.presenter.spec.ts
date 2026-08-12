import type { VideoDetailsView } from '../../domain';
import { VideoPresenter } from './video.presenter';

describe('VideoPresenter', () => {
  it('exposes processing status without storage paths', () => {
    const now = new Date();
    const details: VideoDetailsView = {
      id: 'video',
      lessonId: 'lesson',
      status: 'READY',
      sourceFilename: 'source.mp4',
      sourceSizeBytes: '100',
      durationSeconds: 3,
      width: 1280,
      height: 720,
      isCurrent: false,
      processingError: null,
      createdAt: now,
      updatedAt: now,
      variants: [
        {
          id: 'variant',
          status: 'READY',
          width: 1280,
          height: 720,
          bitrateKbps: 2800,
          videoCodec: 'h264',
          audioCodec: 'aac',
          sizeBytes: '200',
          playlistKey: 'processed/private/index.m3u8',
        } as VideoDetailsView['variants'][number] & { playlistKey: string },
      ],
      processingJobs: [],
    };

    expect(JSON.stringify(VideoPresenter.details(details))).not.toContain(
      'processed/private',
    );
  });
});
