export type VideoStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETING'
  | 'DELETED';

export type UploadStatus =
  'PENDING' | 'UPLOADING' | 'COMPLETED' | 'EXPIRED' | 'ABORTED';

export interface VideoView {
  id: string;
  lessonId: string;
  status: VideoStatus;
  sourceFilename: string;
  sourceSizeBytes: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  isCurrent: boolean;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoUploadView {
  id: string;
  videoId: string;
  status: UploadStatus;
  storageKey: string;
  providerUploadId: string | null;
  expectedSizeBytes: bigint;
  expiresAt: Date;
}

export type ProcessingJobStatus =
  'QUEUED' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface VideoProcessingJobView {
  id: string;
  videoId: string;
  queueJobId: string | null;
  status: ProcessingJobStatus;
  attempt: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoVariantView {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  width: number;
  height: number;
  bitrateKbps: number;
  videoCodec: string;
  audioCodec: string;
  sizeBytes: string | null;
}

export interface VideoDetailsView extends VideoView {
  variants: VideoVariantView[];
  processingJobs: VideoProcessingJobView[];
}

export interface VideoSourceView {
  video: VideoView;
  processingJob: VideoProcessingJobView;
  storageKey: string;
  mimeType: string;
}

export interface VideoProbe {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
}

export interface VideoRendition {
  width: number;
  height: number;
  bitrateKbps: number;
}

export const selectVideoRenditions = (
  sourceWidth: number,
  sourceHeight: number,
): VideoRendition[] => {
  const presets = [
    { height: 360, bitrateKbps: 800 },
    { height: 480, bitrateKbps: 1_400 },
    { height: 720, bitrateKbps: 2_800 },
    { height: 1_080, bitrateKbps: 5_000 },
  ];
  const selected = presets
    .filter(({ height }) => height <= sourceHeight)
    .map(({ height, bitrateKbps }) => ({
      height,
      width: Math.max(
        2,
        Math.round((sourceWidth * height) / sourceHeight / 2) * 2,
      ),
      bitrateKbps,
    }))
    .filter(({ width }) => width <= sourceWidth);

  if (selected.length > 0) return selected;

  return [
    {
      width: Math.max(2, Math.floor(sourceWidth / 2) * 2),
      height: Math.max(2, Math.floor(sourceHeight / 2) * 2),
      bitrateKbps: 600,
    },
  ];
};
