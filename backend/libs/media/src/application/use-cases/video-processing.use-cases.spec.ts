import type { MediaRepositoryPort } from '../ports/media-repository.port';
import type { ObjectStoragePort } from '../ports/object-storage.port';
import type {
  MediaProbePort,
  TemporaryWorkspacePort,
  VideoTranscoderPort,
} from '../ports/video-processing.port';
import { ProcessVideoUseCase } from './video-processing.use-cases';

describe('ProcessVideoUseCase', () => {
  const now = new Date();
  const video = {
    id: 'video',
    lessonId: 'lesson',
    status: 'PROCESSING' as const,
    sourceFilename: 'source.mp4',
    sourceSizeBytes: '12',
    durationSeconds: null,
    width: null,
    height: null,
    isCurrent: false,
    processingError: null,
    createdAt: now,
    updatedAt: now,
  };
  const repository = {
    claimProcessing: jest.fn(),
    markProcessingSucceeded: jest.fn(),
    markProcessingFailed: jest.fn(),
  } as unknown as jest.Mocked<MediaRepositoryPort>;
  const storage = {
    downloadToFile: jest.fn(),
    uploadFile: jest.fn(),
    head: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<ObjectStoragePort>;
  const workspace = {
    create: jest.fn(),
    remove: jest.fn(),
  } as jest.Mocked<TemporaryWorkspacePort>;
  const probe = { inspect: jest.fn() } as jest.Mocked<MediaProbePort>;
  const transcoder = {
    transcode: jest.fn(),
  } as jest.Mocked<VideoTranscoderPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.claimProcessing.mockResolvedValue({
      video,
      processingJob: {
        id: 'processing',
        videoId: 'video',
        queueJobId: 'queue',
        status: 'ACTIVE',
        attempt: 1,
        startedAt: now,
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      },
      storageKey: 'sources/video.mp4',
      mimeType: 'video/mp4',
    });
    workspace.create.mockResolvedValue({
      rootPath: '/tmp/work',
      sourcePath: '/tmp/work/source.mp4',
      outputPath: '/tmp/work/output',
    });
    probe.inspect.mockResolvedValue({
      durationSeconds: 10,
      width: 1280,
      height: 720,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
  });

  it('uploads, verifies, persists, and always removes the workspace', async () => {
    transcoder.transcode.mockResolvedValue({
      masterPlaylistRelativePath: 'master.m3u8',
      thumbnailRelativePath: 'thumbnail.jpg',
      files: [
        {
          absolutePath: '/master',
          relativePath: 'master.m3u8',
          contentType: 'application/vnd.apple.mpegurl',
          sizeBytes: 10,
          checksumSha256: 'a',
        },
        {
          absolutePath: '/thumb',
          relativePath: 'thumbnail.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 20,
          checksumSha256: 'b',
        },
      ],
      variants: [
        {
          width: 1280,
          height: 720,
          bitrateKbps: 2800,
          playlistRelativePath: '720p/index.m3u8',
          sizeBytes: 100,
        },
      ],
    });
    storage.head.mockImplementation((key) =>
      Promise.resolve({
        sizeBytes: key.endsWith('master.m3u8') ? 10 : 20,
        contentType: undefined,
        checksumSha256: key.endsWith('master.m3u8') ? 'a' : 'b',
      }),
    );
    repository.markProcessingSucceeded.mockResolvedValue({
      ...video,
      status: 'READY',
    });
    const useCase = new ProcessVideoUseCase(
      repository,
      storage,
      workspace,
      probe,
      transcoder,
    );

    await expect(
      useCase.execute({
        videoId: 'video',
        processingJobId: 'processing',
        queueJobId: 'queue',
        attempt: 1,
        maximumAttempts: 3,
      }),
    ).resolves.toMatchObject({ status: 'READY' });
    expect(repository.markProcessingSucceeded.mock.calls).toHaveLength(1);
    expect(workspace.remove.mock.calls).toContainEqual(['/tmp/work']);
  });

  it('records a retryable failure and removes the workspace', async () => {
    transcoder.transcode.mockRejectedValue(new Error('encoder crashed'));
    const useCase = new ProcessVideoUseCase(
      repository,
      storage,
      workspace,
      probe,
      transcoder,
    );

    await expect(
      useCase.execute({
        videoId: 'video',
        processingJobId: 'processing',
        queueJobId: 'queue',
        attempt: 1,
        maximumAttempts: 3,
      }),
    ).rejects.toThrow('encoder crashed');
    expect(repository.markProcessingFailed.mock.calls).toContainEqual([
      expect.objectContaining({
        terminal: false,
        errorCode: 'VIDEO_PROCESSING_FAILED',
      }),
    ]);
    expect(workspace.remove.mock.calls).toContainEqual(['/tmp/work']);
  });
});
