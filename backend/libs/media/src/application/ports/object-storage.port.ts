export interface StoredObjectMetadata {
  sizeBytes: number;
  contentType: string | undefined;
  checksumSha256: string | undefined;
}

export interface ObjectStoragePort {
  createUploadUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string>;
  createMultipartUpload(input: {
    key: string;
    contentType: string;
  }): Promise<string>;
  createMultipartPartUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds: number;
  }): Promise<string>;
  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  downloadToFile(key: string, destinationPath: string): Promise<void>;
  uploadFile(input: {
    key: string;
    sourcePath: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('media.object-storage');
