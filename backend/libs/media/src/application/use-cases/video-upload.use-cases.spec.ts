import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { MediaRepositoryPort } from '../ports/media-repository.port';
import type { ObjectStoragePort } from '../ports/object-storage.port';
import { InvalidUploadError } from '../../domain';
import {
  CompleteVideoUploadUseCase,
  InitiateVideoUploadUseCase,
} from './video-upload.use-cases';

describe('video upload use cases', () => {
  const repository = {
    createUpload: jest.fn(),
    findUpload: jest.fn(),
    completeUpload: jest.fn(),
    getVideo: jest.fn(),
    getVideoDetails: jest.fn(),
    getQueueableProcessingJob: jest.fn(),
    claimProcessing: jest.fn(),
    markProcessingSucceeded: jest.fn(),
    markProcessingFailed: jest.fn(),
    retryProcessing: jest.fn(),
    activateVideo: jest.fn(),
    expireUploads: jest.fn(),
    createLessonResource: jest.fn(),
    findLessonResource: jest.fn(),
    completeLessonResource: jest.fn(),
    findAuthorizedLessonResource: jest.fn(),
    expireLessonResources: jest.fn(),
  } as jest.Mocked<MediaRepositoryPort>;
  const storage = {
    createUploadUrl: jest.fn(),
    createMultipartUpload: jest.fn(),
    createMultipartPartUrl: jest.fn(),
    completeMultipartUpload: jest.fn(),
    abortMultipartUpload: jest.fn(),
    createDownloadUrl: jest.fn(),
    downloadToFile: jest.fn(),
    uploadFile: jest.fn(),
    head: jest.fn(),
    delete: jest.fn(),
  } as jest.Mocked<ObjectStoragePort>;
  const queue = { add: jest.fn() } as unknown as jest.Mocked<Queue>;
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'storage.maxVideoBytes' ? 1_000_000 : 900,
    ),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('rejects unsupported video metadata before persistence', async () => {
    const useCase = new InitiateVideoUploadUseCase(repository, storage, config);
    await expect(
      useCase.execute({
        lessonId: 'lesson',
        actorUserId: 'owner',
        filename: 'payload.exe',
        mimeType: 'application/octet-stream',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(InvalidUploadError);
    expect(repository.createUpload.mock.calls).toHaveLength(0);
  });

  it('verifies the private object before queueing processing', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    repository.findUpload.mockResolvedValue({
      id: 'upload',
      videoId: 'video',
      status: 'PENDING',
      storageKey: 'sources/lesson/video.mp4',
      providerUploadId: null,
      expectedSizeBytes: 128n,
      expiresAt,
    });
    storage.head.mockResolvedValue({
      sizeBytes: 128,
      contentType: 'video/mp4',
      checksumSha256: 'checksum',
    });
    repository.completeUpload.mockResolvedValue({
      processingJobId: 'processing-job',
      video: {
        id: 'video',
        lessonId: 'lesson',
        status: 'QUEUED',
        sourceFilename: 'video.mp4',
        sourceSizeBytes: '128',
        durationSeconds: null,
        width: null,
        height: null,
        isCurrent: false,
        processingError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const useCase = new CompleteVideoUploadUseCase(repository, storage, queue);
    await expect(useCase.execute('upload')).resolves.toMatchObject({
      id: 'video',
      status: 'QUEUED',
    });
    expect(queue.add.mock.calls).toContainEqual([
      'transcode-video',
      { videoId: 'video', processingJobId: 'processing-job' },
      { jobId: 'processing-processing-job' },
    ]);
  });

  it('rejects a size mismatch without mutating upload state', async () => {
    repository.findUpload.mockResolvedValue({
      id: 'upload',
      videoId: 'video',
      status: 'PENDING',
      storageKey: 'source',
      providerUploadId: null,
      expectedSizeBytes: 128n,
      expiresAt: new Date(Date.now() + 60_000),
    });
    storage.head.mockResolvedValue({
      sizeBytes: 127,
      contentType: 'video/mp4',
      checksumSha256: undefined,
    });
    const useCase = new CompleteVideoUploadUseCase(repository, storage, queue);
    await expect(useCase.execute('upload')).rejects.toBeInstanceOf(
      InvalidUploadError,
    );
    expect(repository.completeUpload.mock.calls).toHaveLength(0);
  });
});
