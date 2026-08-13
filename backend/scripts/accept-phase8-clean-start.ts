import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ApiModule } from '../apps/api/src/api.module';
import { configureApi } from '../apps/api/src/bootstrap/configure-api';
import { VideoWorkerModule } from '../apps/video-worker/src/video-worker.module';

const backendDirectory = resolve(__dirname, '..');
const workspaceDirectory = resolve(backendDirectory, '..');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const dockerExecutable = process.platform === 'win32' ? 'docker.exe' : 'docker';

interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
}

interface ApiResult<T> {
  body: T;
  response: Response;
}

interface Identified {
  id: string;
}

interface AuthResponse {
  accessToken: string;
  user: Identified;
  device: Identified;
}

interface UploadResponse {
  id: string;
  videoId: string;
  uploadUrl: string | null;
  uploadMode: 'SINGLE' | 'MULTIPART';
}

interface VideoResponse {
  id: string;
  status: string;
  isCurrent: boolean;
  processingError: string | null;
  variants?: Array<{ width: number; height: number; videoCodec: string }>;
}

interface PlaybackResponse {
  id: string;
  videoId: string;
  status: string;
  hlsUrl: string;
  sessionCode: string;
  lastPositionSeconds: number;
  heartbeatIntervalSeconds: number;
  leaseExpiresAt: string;
}

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

function runCommand(
  executable: string,
  args: string[],
  options: CommandOptions = {},
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const environment = Object.fromEntries(
      Object.entries(options.env ?? process.env).filter(
        (entry): entry is [string, string] =>
          !entry[0].startsWith('=') && entry[1] !== undefined,
      ),
    );
    let child: ReturnType<typeof spawn>;
    const usesWindowsCommandShim =
      process.platform === 'win32' && executable.endsWith('.cmd');
    const effectiveExecutable = usesWindowsCommandShim
      ? (process.env.ComSpec ?? 'cmd.exe')
      : executable;
    const effectiveArguments = usesWindowsCommandShim
      ? ['/d', '/s', '/c', executable, ...args]
      : args;
    try {
      child = spawn(effectiveExecutable, effectiveArguments, {
        cwd: options.cwd ?? workspaceDirectory,
        env: environment,
        windowsHide: true,
        stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      });
    } catch (error: unknown) {
      reject(
        new Error(
          `Could not spawn ${executable} ${args.join(' ')}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        ),
      );
      return;
    }
    let output = '';
    if (options.quiet && child.stdout && child.stderr) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output = `${output}${chunk}`.slice(-16_384);
      });
      child.stderr.on('data', (chunk: string) => {
        output = `${output}${chunk}`.slice(-16_384);
      });
    }
    child.once('error', (error) =>
      reject(
        new Error(
          `Could not start ${executable} ${args.join(' ')}: ${error.message}`,
          { cause: error },
        ),
      ),
    );
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(
            `${executable} ${args.join(' ')} exited with ${code ?? 'no code'}${output ? `\n${output}` : ''}`,
          ),
        );
    });
  });
}

const availablePort = (): Promise<number> =>
  new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo | null;
      if (address === null)
        return reject(new Error('Could not allocate a local port'));
      const port: number = address.port;
      server.close((error) => (error ? reject(error) : resolvePromise(port)));
    });
  });

async function api<T>(
  baseUrl: string,
  path: string,
  expectedStatus: number,
  accessToken?: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = (
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  ) as T;
  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method ?? 'GET'} ${path}: expected ${expectedStatus}, received ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return { body, response };
}

async function waitForVideo(
  baseUrl: string,
  ownerToken: string,
  videoId: string,
  expectedStatus: 'READY' | 'FAILED',
): Promise<VideoResponse> {
  const deadline = Date.now() + 120_000;
  let latest: VideoResponse | undefined;
  while (Date.now() < deadline) {
    latest = (
      await api<VideoResponse>(
        baseUrl,
        `/owner/videos/${videoId}`,
        200,
        ownerToken,
      )
    ).body;
    if (latest.status === expectedStatus) return latest;
    if (latest.status === 'FAILED' && expectedStatus !== 'FAILED') {
      throw new Error(
        `Video ${videoId} failed unexpectedly: ${latest.processingError ?? 'unknown processing error'}`,
      );
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error(
    `Video ${videoId} did not reach ${expectedStatus}; latest status was ${latest?.status ?? 'unknown'}`,
  );
}

async function generateSampleVideo(directory: string): Promise<string> {
  const path = join(directory, 'phase8-source.mp4');
  await runCommand(
    ffmpegInstaller.path,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=1280x720:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:sample_rate=44100',
      '-t',
      '3',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      path,
    ],
    { quiet: true },
  );
  return path;
}

async function directUpload(
  baseUrl: string,
  ownerToken: string,
  lessonId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<UploadResponse> {
  const upload = (
    await api<UploadResponse>(
      baseUrl,
      `/owner/lessons/${lessonId}/video-uploads`,
      201,
      ownerToken,
      {
        method: 'POST',
        headers: { 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          filename,
          mimeType: 'video/mp4',
          sizeBytes: bytes.byteLength,
        }),
      },
    )
  ).body;
  assert(
    upload.uploadMode === 'SINGLE',
    'Small test video was not single-part',
  );
  assert(upload.uploadUrl !== null, 'Direct upload URL was not returned');
  assert(
    new URL(upload.uploadUrl).origin !== new URL(baseUrl).origin,
    'Video bytes would traverse the NestJS API',
  );
  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'video/mp4',
      'content-length': String(bytes.byteLength),
    },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(30_000),
  });
  assert(put.ok, `Private-storage upload failed with ${put.status}`);
  await api(
    baseUrl,
    `/owner/video-uploads/${upload.id}/complete`,
    202,
    ownerToken,
    { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
  );
  return upload;
}

async function runReleaseWorkflow(
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  Object.assign(process.env, environment);
  const app = await NestFactory.create(ApiModule, { logger: false });
  let worker:
    | Awaited<ReturnType<typeof NestFactory.createApplicationContext>>
    | undefined;
  const directory = await mkdtemp(join(tmpdir(), 'lms-phase8-media-'));
  const s3 = new S3Client({
    endpoint: environment.OBJECT_STORAGE_ENDPOINT,
    region: environment.OBJECT_STORAGE_REGION,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: environment.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: environment.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  try {
    process.stdout.write('Phase 8 workflow: booting API and worker.\n');
    configureApi(app, app.get(ConfigService));
    await app.listen(Number(environment.API_PORT), '127.0.0.1');
    worker = await NestFactory.createApplicationContext(VideoWorkerModule, {
      logger: false,
    });
    process.stdout.write('Phase 8 workflow: API and worker ready.\n');
    const baseUrl = `http://127.0.0.1:${environment.API_PORT}/api/v1`;
    const ownerEmail = environment.OWNER_EMAIL!;
    const ownerPassword = environment.OWNER_PASSWORD!;
    const studentEmail = 'phase8-student@example.test';
    const studentPassword = `${randomBytes(24).toString('base64url')}Aa1!`;

    const student = (
      await api<Identified>(baseUrl, '/auth/register', 201, undefined, {
        method: 'POST',
        body: JSON.stringify({
          email: studentEmail,
          password: studentPassword,
          firstName: 'Phase',
          lastName: 'Eight',
        }),
      })
    ).body;
    process.stdout.write('Phase 8 workflow: student registered.\n');
    const login = (
      email: string,
      password: string,
      deviceName: string,
    ): Promise<ApiResult<AuthResponse>> =>
      api<AuthResponse>(baseUrl, '/auth/login', 200, undefined, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          device: { clientDeviceId: randomUUID(), name: deviceName },
        }),
      });
    const owner = (await login(ownerEmail, ownerPassword, 'Owner release'))
      .body;
    const studentFirst = (
      await login(studentEmail, studentPassword, 'Student release first')
    ).body;
    process.stdout.write(
      'Phase 8 workflow: owner and student authenticated.\n',
    );

    const course = (
      await api<Identified>(baseUrl, '/owner/courses', 201, owner.accessToken, {
        method: 'POST',
        headers: { 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          title: 'Phase 8 release course',
          slug: 'phase-8-release-course',
          description: 'Clean-start release acceptance',
        }),
      })
    ).body;
    const section = (
      await api<Identified>(
        baseUrl,
        `/owner/courses/${course.id}/sections`,
        201,
        owner.accessToken,
        {
          method: 'POST',
          headers: { 'idempotency-key': randomUUID() },
          body: JSON.stringify({ title: 'Release section' }),
        },
      )
    ).body;
    const lesson = (
      await api<Identified>(
        baseUrl,
        `/owner/sections/${section.id}/lessons`,
        201,
        owner.accessToken,
        {
          method: 'POST',
          headers: { 'idempotency-key': randomUUID() },
          body: JSON.stringify({ title: 'Release video', type: 'VIDEO' }),
        },
      )
    ).body;
    await api(
      baseUrl,
      `/owner/courses/${course.id}/publish`,
      200,
      owner.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );
    await api(
      baseUrl,
      `/owner/courses/${course.id}/enrollments`,
      201,
      owner.accessToken,
      {
        method: 'POST',
        headers: { 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          userId: student.id,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          status: 'ACTIVE',
        }),
      },
    );
    process.stdout.write(
      'Phase 8 workflow: curriculum and enrollment ready.\n',
    );

    process.stdout.write('Phase 8 workflow: proving invalid-media failure.\n');
    const invalidUpload = await directUpload(
      baseUrl,
      owner.accessToken,
      lesson.id,
      'invalid.mp4',
      randomBytes(2_048),
    );
    const failedVideo = await waitForVideo(
      baseUrl,
      owner.accessToken,
      invalidUpload.videoId,
      'FAILED',
    );
    assert(
      failedVideo.processingError !== null,
      'Invalid video failure was not visible to the owner',
    );

    process.stdout.write('Phase 8 workflow: generating valid sample.\n');
    const sourcePath = await generateSampleVideo(directory);
    process.stdout.write('Phase 8 workflow: processing valid sample.\n');
    const validUpload = await directUpload(
      baseUrl,
      owner.accessToken,
      lesson.id,
      'release.mp4',
      new Uint8Array(await readFile(sourcePath)),
    );
    const readyVideo = await waitForVideo(
      baseUrl,
      owner.accessToken,
      validUpload.videoId,
      'READY',
    );
    assert(
      readyVideo.variants?.some(({ height }) => height === 360) &&
        readyVideo.variants.some(({ height }) => height === 720) &&
        readyVideo.variants.every(({ height }) => height <= 720) &&
        readyVideo.variants.every(({ videoCodec }) => videoCodec === 'h264'),
      'Worker did not produce the expected non-upscaled H.264 renditions',
    );
    await api(
      baseUrl,
      `/owner/lessons/${lesson.id}/videos/${validUpload.videoId}/activate`,
      200,
      owner.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );

    const prefix = `processed/${validUpload.videoId}/hls/`;
    const objects = await s3.send(
      new ListObjectsV2Command({
        Bucket: environment.OBJECT_STORAGE_BUCKET,
        Prefix: prefix,
      }),
    );
    const objectKeys =
      objects.Contents?.flatMap(({ Key }) =>
        Key === undefined ? [] : [Key],
      ) ?? [];
    assert(
      objectKeys.some((key) => key.endsWith('/master.m3u8')) &&
        objectKeys.some((key) => key.includes('/360p/index.m3u8')) &&
        objectKeys.some((key) => key.includes('/720p/index.m3u8')) &&
        objectKeys.some((key) => key.endsWith('.ts')),
      'Verified adaptive HLS package was incomplete',
    );
    const master = await s3.send(
      new GetObjectCommand({
        Bucket: environment.OBJECT_STORAGE_BUCKET,
        Key: `${prefix}master.m3u8`,
      }),
    );
    const manifest = await master.Body?.transformToString();
    assert(
      manifest?.includes('#EXTM3U') &&
        manifest.includes('360p/index.m3u8') &&
        manifest.includes('720p/index.m3u8'),
      'Master manifest did not reference both adaptive renditions',
    );
    const publicAttempt = await fetch(
      `${environment.OBJECT_STORAGE_ENDPOINT}/${environment.OBJECT_STORAGE_BUCKET}/${prefix}master.m3u8`,
      { signal: AbortSignal.timeout(5_000) },
    );
    assert(
      publicAttempt.status === 403 || publicAttempt.status === 404,
      `Private object storage returned ${publicAttempt.status} without authorization`,
    );

    await api(
      baseUrl,
      `/me/lessons/${lesson.id}/progress`,
      200,
      studentFirst.accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({ positionSeconds: 57, watchedSeconds: 57 }),
      },
    );
    const firstPlaybackResult = await api<PlaybackResponse>(
      baseUrl,
      `/me/lessons/${lesson.id}/playback-sessions`,
      201,
      studentFirst.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );
    const firstPlayback = firstPlaybackResult.body;
    const mediaCookie = firstPlaybackResult.response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('lms_media_lease='));
    if (mediaCookie === undefined || !mediaCookie.includes('HttpOnly')) {
      throw new Error('Media lease was not HttpOnly');
    }
    assert(
      mediaCookie.includes('SameSite=Strict') &&
        mediaCookie.includes('Path=/media'),
      'Media lease cookie scope is not sufficiently narrow',
    );
    assert(
      firstPlayback.hlsUrl ===
        `/media/hls/${validUpload.videoId}/master.m3u8` &&
        firstPlayback.lastPositionSeconds === 57 &&
        firstPlayback.heartbeatIntervalSeconds === 30 &&
        /^[A-Z0-9_-]{8}$/.test(firstPlayback.sessionCode),
      'Playback did not return a resumable, short-lived, watermark-ready session',
    );
    const serializedPlayback = JSON.stringify(firstPlayback);
    for (const forbidden of [
      'storageKey',
      'playlistKey',
      'uploadUrl',
      'accessKey',
      'secret',
      environment.OBJECT_STORAGE_ENDPOINT!,
    ]) {
      assert(
        !serializedPlayback.includes(forbidden),
        `Student playback response exposed ${forbidden}`,
      );
    }
    await api(
      baseUrl,
      `/me/playback-sessions/${firstPlayback.id}/heartbeat`,
      200,
      studentFirst.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 64 }) },
    );

    const studentSecond = (
      await login(studentEmail, studentPassword, 'Student release second')
    ).body;
    const secondPlayback = (
      await api<PlaybackResponse>(
        baseUrl,
        `/me/lessons/${lesson.id}/playback-sessions`,
        201,
        studentSecond.accessToken,
        { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
      )
    ).body;
    assert(
      secondPlayback.id !== firstPlayback.id &&
        secondPlayback.sessionCode !== firstPlayback.sessionCode,
      'Replacement playback did not create a distinct watermark/session',
    );
    await api(
      baseUrl,
      `/me/playback-sessions/${firstPlayback.id}/heartbeat`,
      409,
      studentFirst.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 65 }) },
    );
    await api(
      baseUrl,
      `/me/playback-sessions/${secondPlayback.id}/heartbeat`,
      200,
      studentSecond.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 66 }) },
    );

    await api(
      baseUrl,
      `/owner/courses/${course.id}/archive`,
      200,
      owner.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );
    await api(
      baseUrl,
      `/me/lessons/${lesson.id}`,
      404,
      studentSecond.accessToken,
    );
    process.stdout.write(
      `Phase 8 release workflow passed: owner curriculum, direct private upload, safe failure, ${objectKeys.length} verified HLS objects, progress/resume, watermark code, replacement playback, and archive enforcement.\n`,
    );
  } finally {
    await worker?.close();
    await app.close();
    s3.destroy();
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const suffix = randomBytes(4).toString('hex');
  const project = `lms-phase8-${process.pid}-${suffix}`;
  assert(
    /^lms-phase8-[0-9]+-[a-f0-9]{8}$/.test(project),
    'Unsafe disposable Compose project name',
  );
  const [postgresPort, redisPort, storagePort, storageConsolePort, apiPort] =
    await Promise.all([
      availablePort(),
      availablePort(),
      availablePort(),
      availablePort(),
      availablePort(),
    ]);
  const postgresPassword = randomBytes(24).toString('base64url');
  const storageAccessKey = `phase8${randomBytes(8).toString('hex')}`;
  const storageSecret = randomBytes(32).toString('base64url');
  const ownerPassword = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const composeEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    POSTGRES_DB: 'lms_phase8',
    POSTGRES_USER: 'lms_phase8',
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_PORT: String(postgresPort),
    REDIS_PORT: String(redisPort),
    OBJECT_STORAGE_PORT: String(storagePort),
    OBJECT_STORAGE_CONSOLE_PORT: String(storageConsolePort),
    OBJECT_STORAGE_ACCESS_KEY_ID: storageAccessKey,
    OBJECT_STORAGE_SECRET_ACCESS_KEY: storageSecret,
    CORS_ORIGINS: 'http://localhost:5173',
  };
  const databaseUrl = `postgresql://lms_phase8:${encodeURIComponent(postgresPassword)}@127.0.0.1:${postgresPort}/lms_phase8`;
  const appEnvironment: NodeJS.ProcessEnv = {
    ...composeEnvironment,
    NODE_ENV: 'development',
    API_PORT: String(apiPort),
    APP_URL: `http://127.0.0.1:${apiPort}`,
    LOG_LEVEL: 'silent',
    API_DOCS_ENABLED: 'false',
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: '5',
    REDIS_URL: `redis://127.0.0.1:${redisPort}/0`,
    VIDEO_QUEUE_PREFIX: `phase8-${suffix}`,
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
    JWT_ACCESS_TTL_SECONDS: '900',
    REFRESH_TOKEN_SECRET: randomBytes(48).toString('base64url'),
    REFRESH_TOKEN_TTL_SECONDS: '2592000',
    MAX_REGISTERED_DEVICES: '5',
    PASSWORD_RESET_TTL_SECONDS: '3600',
    OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${storagePort}`,
    OBJECT_STORAGE_REGION: 'us-east-1',
    OBJECT_STORAGE_BUCKET: 'lms-phase8-private',
    OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
    OBJECT_STORAGE_UPLOAD_TTL_SECONDS: '900',
    MAX_VIDEO_UPLOAD_BYTES: '10737418240',
    FFMPEG_PATH: ffmpegInstaller.path,
    FFPROBE_PATH: ffprobeInstaller.path,
    MEDIA_LEASE_PRIVATE_KEY: privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64'),
    MEDIA_LEASE_TTL_SECONDS: '90',
    PLAYBACK_HEARTBEAT_INTERVAL_SECONDS: '30',
    PLAYBACK_STALE_AFTER_SECONDS: '120',
    PLAYBACK_REDIS_PREFIX: `phase8:${suffix}:playback`,
    OWNER_EMAIL: 'phase8-owner@example.test',
    OWNER_PASSWORD: ownerPassword,
    OWNER_FIRST_NAME: 'Release',
    OWNER_LAST_NAME: 'Owner',
    BACKUP_S3_ENDPOINT: `http://127.0.0.1:${storagePort}`,
    BACKUP_S3_REGION: 'us-east-1',
    BACKUP_S3_ACCESS_KEY_ID: storageAccessKey,
    BACKUP_S3_SECRET_ACCESS_KEY: storageSecret,
    BACKUP_S3_BUCKET: 'lms-phase8-backups',
    BACKUP_S3_FORCE_PATH_STYLE: 'true',
    BACKUP_PREFIX: 'postgres',
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    BACKUP_RETENTION_DAYS: '30',
    BACKUP_MIN_COPIES: '1',
  };
  const composeArgs = ['compose', '-p', project, '-f', 'compose.yaml'];
  let infrastructureStarted = false;
  let maintenanceImage: string | undefined;
  try {
    process.stdout.write(`Starting isolated clean environment ${project}.\n`);
    await runCommand(dockerExecutable, [...composeArgs, 'up', '-d', '--wait'], {
      cwd: workspaceDirectory,
      env: composeEnvironment,
      quiet: true,
    });
    infrastructureStarted = true;
    await runCommand(npmExecutable, ['run', 'prisma:generate'], {
      cwd: backendDirectory,
      env: appEnvironment,
      quiet: true,
    });
    for (let pass = 0; pass < 2; pass += 1) {
      await runCommand(npmExecutable, ['run', 'db:migrate:deploy'], {
        cwd: backendDirectory,
        env: appEnvironment,
        quiet: true,
      });
      await runCommand(npmExecutable, ['run', 'db:seed'], {
        cwd: backendDirectory,
        env: appEnvironment,
        quiet: true,
      });
      await runCommand(npmExecutable, ['run', 'db:create-owner'], {
        cwd: backendDirectory,
        env: appEnvironment,
        quiet: true,
      });
    }
    await runReleaseWorkflow(appEnvironment);

    await runCommand(npmExecutable, ['run', 'accept:phase6'], {
      cwd: backendDirectory,
      env: appEnvironment,
    });
    await runCommand(npmExecutable, ['run', 'accept:phase7:security'], {
      cwd: backendDirectory,
      env: appEnvironment,
    });

    const backupS3 = new S3Client({
      endpoint: appEnvironment.BACKUP_S3_ENDPOINT,
      region: appEnvironment.BACKUP_S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storageAccessKey,
        secretAccessKey: storageSecret,
      },
    });
    try {
      await backupS3.send(
        new CreateBucketCommand({ Bucket: appEnvironment.BACKUP_S3_BUCKET }),
      );
    } finally {
      backupS3.destroy();
    }
    maintenanceImage = `lms-backend-maintenance:phase8-${suffix}`;
    await runCommand(
      dockerExecutable,
      [
        'build',
        '--target',
        'maintenance',
        '-t',
        maintenanceImage,
        '-f',
        'backend/Dockerfile',
        '.',
      ],
      { cwd: workspaceDirectory, env: composeEnvironment },
    );
    const maintenanceEnvironment: Record<string, string> = {
      DATABASE_URL: `postgresql://lms_phase8:${encodeURIComponent(postgresPassword)}@postgres:5432/lms_phase8`,
      BACKUP_S3_ENDPOINT: 'http://object-storage:9000',
      BACKUP_S3_REGION: 'us-east-1',
      BACKUP_S3_ACCESS_KEY_ID: storageAccessKey,
      BACKUP_S3_SECRET_ACCESS_KEY: storageSecret,
      BACKUP_S3_BUCKET: appEnvironment.BACKUP_S3_BUCKET!,
      BACKUP_S3_FORCE_PATH_STYLE: 'true',
      BACKUP_PREFIX: 'postgres',
      BACKUP_ENCRYPTION_KEY: appEnvironment.BACKUP_ENCRYPTION_KEY!,
      BACKUP_RETENTION_DAYS: '30',
      BACKUP_MIN_COPIES: '1',
    };
    const maintenanceArgs = Object.entries(maintenanceEnvironment).flatMap(
      ([name, value]) => ['-e', `${name}=${value}`],
    );
    for (const command of ['backup:create', 'backup:verify']) {
      await runCommand(
        dockerExecutable,
        [
          'run',
          '--rm',
          '--network',
          `${project}_default`,
          ...maintenanceArgs,
          maintenanceImage,
          'npm',
          'run',
          command,
        ],
        { cwd: workspaceDirectory, env: composeEnvironment },
      );
    }
    process.stdout.write('Phase 8 clean-start acceptance passed completely.\n');
  } finally {
    if (infrastructureStarted) {
      await runCommand(
        dockerExecutable,
        [...composeArgs, 'down', '--volumes', '--remove-orphans'],
        { cwd: workspaceDirectory, env: composeEnvironment, quiet: true },
      ).catch((error: unknown) => {
        process.stderr.write(
          `Disposable Compose cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      });
    }
    if (maintenanceImage !== undefined) {
      await runCommand(dockerExecutable, ['image', 'rm', maintenanceImage], {
        cwd: workspaceDirectory,
        env: composeEnvironment,
        quiet: true,
      }).catch(() => undefined);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
