import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { InvalidVideoSourceError, ProcessVideoUseCase } from '@lms/media';
import {
  VideoProcessingProcessor,
  type VideoProcessingJobData,
} from './video-processing.processor';

describe('VideoProcessingProcessor', () => {
  const processVideo = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<ProcessVideoUseCase>;
  const job = {
    id: 'queue-job',
    name: 'transcode-video',
    data: { videoId: 'video', processingJobId: 'processing' },
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as Job<VideoProcessingJobData>;

  beforeEach(() => jest.clearAllMocks());

  it('passes BullMQ attempt metadata to the use case', async () => {
    processVideo.execute.mockResolvedValue({} as never);

    await expect(
      new VideoProcessingProcessor(processVideo).process(job),
    ).resolves.toEqual({ videoId: 'video' });
    expect(processVideo.execute.mock.calls).toEqual([
      [
        {
          videoId: 'video',
          processingJobId: 'processing',
          queueJobId: 'queue-job',
          attempt: 2,
          maximumAttempts: 3,
        },
      ],
    ]);
  });

  it('lets transient failures bubble so BullMQ retries them', async () => {
    const failure = new Error('temporary storage outage');
    processVideo.execute.mockRejectedValue(failure);

    await expect(
      new VideoProcessingProcessor(processVideo).process(job),
    ).rejects.toBe(failure);
  });

  it('marks invalid media and unsupported jobs as unrecoverable', async () => {
    processVideo.execute.mockRejectedValue(
      new InvalidVideoSourceError('invalid container'),
    );
    const processor = new VideoProcessingProcessor(processVideo);

    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    await expect(
      processor.process({ name: 'unknown-job' } as Job<VideoProcessingJobData>),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
