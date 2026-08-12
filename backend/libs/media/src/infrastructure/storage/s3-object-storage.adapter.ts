import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ObjectStoragePort,
  StoredObjectMetadata,
} from '../../application';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort, OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly createBucketLocally: boolean;
  private readonly skipInitialization: boolean;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>('storage.endpoint');
    this.bucket = config.getOrThrow<string>('storage.bucket');
    this.createBucketLocally = new URL(endpoint).hostname === '127.0.0.1';
    this.skipInitialization =
      config.getOrThrow<string>('app.nodeEnv') === 'test';
    this.client = new S3Client({
      endpoint,
      region: config.getOrThrow<string>('storage.region'),
      forcePathStyle: config.getOrThrow<boolean>('storage.forcePathStyle'),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.getOrThrow<string>('storage.accessKeyId'),
        secretAccessKey: config.getOrThrow<string>('storage.secretAccessKey'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.skipInitialization) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      if (!this.createBucketLocally) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  createUploadUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async createMultipartUpload(input: {
    key: string;
    contentType: string;
  }): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
    );
    if (!result.UploadId) {
      throw new Error('Object storage did not return an upload ID');
    }
    return result.UploadId;
  }

  createMultipartPartUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds: number;
  }): Promise<string> {
    return getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (result.Body === undefined) {
      throw new Error('Object storage returned an empty response body');
    }
    await pipeline(
      result.Body as NodeJS.ReadableStream,
      createWriteStream(destinationPath),
    );
  }

  async uploadFile(input: {
    key: string;
    sourcePath: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<void> {
    const size = (await stat(input.sourcePath)).size;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: createReadStream(input.sourcePath),
        ContentLength: size,
        ContentType: input.contentType,
        Metadata: { sha256: input.checksumSha256 },
      }),
    );
  }

  async head(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
        checksumSha256: result.ChecksumSHA256 ?? result.Metadata?.sha256,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
