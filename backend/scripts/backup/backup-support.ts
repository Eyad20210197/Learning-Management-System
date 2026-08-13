import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  appendFile,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const MAGIC = Buffer.from('LMSBKP1\n', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface BackupConfig {
  databaseUrl: URL;
  restoreDatabaseUrl?: URL;
  encryptionKey: Buffer;
  bucket: string;
  prefix: string;
  retentionDays: number;
  minimumCopies: number;
  pgDumpPath: string;
  pgRestorePath: string;
  s3: S3Client;
}

export interface BackupManifest {
  version: 1;
  createdAt: string;
  database: string;
  encryptedObjectKey: string;
  sha256: string;
  encryption: 'AES-256-GCM';
  format: 'pg_dump-custom';
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const integer = (name: string, fallback: number, minimum: number): number => {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum)
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}`,
    );
  return value;
};

const databaseUrl = (name: string, optional = false): URL | undefined => {
  const value = process.env[name]?.trim();
  if (optional && !value) return undefined;
  const parsed = new URL(value ?? required(name));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error(`${name} must be a PostgreSQL URL`);
  if (parsed.pathname.length <= 1)
    throw new Error(`${name} must name a database`);
  return parsed;
};

export function loadBackupConfig(): BackupConfig {
  const key = Buffer.from(required('BACKUP_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32)
    throw new Error('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes');
  const endpoint = required('BACKUP_S3_ENDPOINT');
  return {
    databaseUrl: databaseUrl('DATABASE_URL')!,
    restoreDatabaseUrl: databaseUrl('BACKUP_RESTORE_DATABASE_URL', true),
    encryptionKey: key,
    bucket: required('BACKUP_S3_BUCKET'),
    prefix: (process.env.BACKUP_PREFIX?.trim() || 'postgres').replace(
      /^\/+|\/+$/g,
      '',
    ),
    retentionDays: integer('BACKUP_RETENTION_DAYS', 30, 1),
    minimumCopies: integer('BACKUP_MIN_COPIES', 7, 1),
    pgDumpPath: process.env.BACKUP_PG_DUMP_PATH?.trim() || 'pg_dump',
    pgRestorePath: process.env.BACKUP_PG_RESTORE_PATH?.trim() || 'pg_restore',
    s3: new S3Client({
      endpoint,
      region: process.env.BACKUP_S3_REGION?.trim() || 'auto',
      forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: required('BACKUP_S3_ACCESS_KEY_ID'),
        secretAccessKey: required('BACKUP_S3_SECRET_ACCESS_KEY'),
      },
    }),
  };
}

function databaseArguments(url: URL): string[] {
  const args = [
    '--host',
    url.hostname,
    '--port',
    url.port || '5432',
    '--username',
    decodeURIComponent(url.username),
    '--dbname',
    decodeURIComponent(url.pathname.slice(1)),
  ];
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode !== null) args.push(`--no-password`);
  return args;
}

export async function runPostgresTool(
  executable: string,
  args: string[],
  url: URL,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [...databaseArguments(url), ...args], {
      env: {
        ...process.env,
        PGPASSWORD: decodeURIComponent(url.password),
        ...(url.searchParams.get('sslmode') === null
          ? {}
          : { PGSSLMODE: url.searchParams.get('sslmode')! }),
      },
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let standardError = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      standardError = `${standardError}${chunk}`.slice(-8_192);
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `PostgreSQL backup tool exited with code ${code}: ${standardError.trim()}`,
          ),
        );
    });
  });
}

export async function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'lms-backup-'));
}

export async function removeTemporaryDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function encryptBackup(
  source: string,
  target: string,
  key: Buffer,
): Promise<void> {
  const iv = randomBytes(IV_BYTES);
  await writeFile(target, Buffer.concat([MAGIC, iv]), { mode: 0o600 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  await pipeline(
    createReadStream(source),
    cipher,
    createWriteStream(target, { flags: 'a', mode: 0o600 }),
  );
  await appendFile(target, cipher.getAuthTag());
}

export async function decryptBackup(
  source: string,
  target: string,
  key: Buffer,
): Promise<void> {
  const file = await open(source, 'r');
  try {
    const { size } = await file.stat();
    const minimumSize = MAGIC.length + IV_BYTES + TAG_BYTES + 1;
    if (size < minimumSize) throw new Error('Encrypted backup is truncated');
    const header = Buffer.alloc(MAGIC.length + IV_BYTES);
    await file.read(header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error('Encrypted backup header is invalid');
    const tag = Buffer.alloc(TAG_BYTES);
    await file.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      header.subarray(MAGIC.length),
    );
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(source, {
        start: header.length,
        end: size - TAG_BYTES - 1,
      }),
      decipher,
      createWriteStream(target, { mode: 0o600 }),
    );
  } finally {
    await file.close();
  }
}

export async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export async function uploadFile(
  config: BackupConfig,
  key: string,
  path: string,
  contentType: string,
): Promise<void> {
  await config.s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: createReadStream(path),
      ContentType: contentType,
      Metadata: { encryption: 'AES-256-GCM' },
    }),
  );
}

export async function uploadManifest(
  config: BackupConfig,
  key: string,
  manifest: BackupManifest,
): Promise<void> {
  await config.s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
      Metadata: { encryptedPayload: 'AES-256-GCM' },
    }),
  );
}

export async function downloadFile(
  config: BackupConfig,
  key: string,
  target: string,
): Promise<void> {
  const result = await config.s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (result.Body === undefined)
    throw new Error(`Backup object ${key} is empty`);
  await pipeline(
    Readable.from(result.Body as unknown as AsyncIterable<Uint8Array>),
    createWriteStream(target, { mode: 0o600 }),
  );
}

export async function readManifest(
  config: BackupConfig,
  key: string,
): Promise<BackupManifest> {
  const result = await config.s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (result.Body === undefined) throw new Error(`Manifest ${key} is empty`);
  const parsed = JSON.parse(
    await result.Body.transformToString(),
  ) as BackupManifest;
  if (parsed.version !== 1 || parsed.encryption !== 'AES-256-GCM')
    throw new Error(`Manifest ${key} is unsupported`);
  return parsed;
}

export async function latestManifestKey(config: BackupConfig): Promise<string> {
  const result = await config.s3.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: `${config.prefix}/`,
    }),
  );
  const latest = (result.Contents ?? [])
    .filter((item) => item.Key?.endsWith('.manifest.json'))
    .sort(
      (left, right) =>
        (right.LastModified?.getTime() ?? 0) -
        (left.LastModified?.getTime() ?? 0),
    )[0]?.Key;
  if (latest === undefined)
    throw new Error('No PostgreSQL backup manifest exists');
  return latest;
}

export async function applyRetention(config: BackupConfig): Promise<number> {
  const result = await config.s3.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: `${config.prefix}/`,
    }),
  );
  const manifests = (result.Contents ?? [])
    .filter(
      (item): item is typeof item & { Key: string; LastModified: Date } =>
        item.Key?.endsWith('.manifest.json') === true &&
        item.LastModified !== undefined,
    )
    .sort(
      (left, right) =>
        right.LastModified.getTime() - left.LastModified.getTime(),
    );
  const cutoff = Date.now() - config.retentionDays * 86_400_000;
  const expired = manifests
    .slice(config.minimumCopies)
    .filter((item) => item.LastModified.getTime() < cutoff);
  if (expired.length === 0) return 0;
  const keys = expired.flatMap(({ Key }) => [
    { Key },
    { Key: Key.replace(/\.manifest\.json$/, '.dump.enc') },
  ]);
  await config.s3.send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: { Objects: keys, Quiet: true },
    }),
  );
  return expired.length;
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}
