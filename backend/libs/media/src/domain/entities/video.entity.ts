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
