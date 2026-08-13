import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

export interface Phase7LoadInput {
  baseUrl: string;
  ownerToken: string;
  studentToken: string;
  courseSlug: string;
  lessonId: string;
  playbackSessionId: string;
}

interface Sample {
  scenario: string;
  milliseconds: number;
  status: number;
}

const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};

async function measured(
  scenario: string,
  url: string,
  accepted: readonly number[],
  options: RequestInit = {},
): Promise<{ sample: Sample; body: unknown }> {
  const started = performance.now();
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => undefined)) as unknown;
  const sample = {
    scenario,
    milliseconds: performance.now() - started,
    status: response.status,
  };
  if (!accepted.includes(response.status))
    throw new Error(
      `${scenario} returned ${response.status}: ${JSON.stringify(body)}`,
    );
  return { sample, body };
}

async function batches<T>(
  count: number,
  concurrency: number,
  operation: (index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let start = 0; start < count; start += concurrency) {
    results.push(
      ...(await Promise.all(
        Array.from(
          { length: Math.min(concurrency, count - start) },
          (_, offset) => operation(start + offset),
        ),
      )),
    );
  }
  return results;
}

function runProcess(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errorOutput = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('FFmpeg capacity probe timed out'));
    }, 60_000);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      errorOutput = `${errorOutput}${chunk}`.slice(-4_096);
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg capacity probe failed: ${errorOutput}`));
    });
  });
}

async function runFfmpegCapacityProbe(): Promise<number> {
  const directory = await mkdtemp(join(tmpdir(), 'lms-load-ffmpeg-'));
  const output = join(directory, 'probe.mp4');
  const started = performance.now();
  try {
    await runProcess(ffmpegInstaller.path, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x180:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1000:sample_rate=44100',
      '-t',
      '1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      output,
    ]);
    return performance.now() - started;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function runPhase7Load(input: Phase7LoadInput): Promise<void> {
  const studentHeaders = { authorization: `Bearer ${input.studentToken}` };
  const ownerHeaders = { authorization: `Bearer ${input.ownerToken}` };
  const samples: Sample[] = [];

  const catalog = await batches(100, 10, () =>
    measured(
      'catalog-browse',
      `${input.baseUrl}/catalog/courses/${input.courseSlug}`,
      [200],
    ),
  );
  samples.push(...catalog.map(({ sample }) => sample));

  const heartbeats = await batches(60, 10, (index) =>
    measured(
      'playback-heartbeat',
      `${input.baseUrl}/me/playback-sessions/${input.playbackSessionId}/heartbeat`,
      [200],
      {
        method: 'POST',
        headers: { ...studentHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ positionSeconds: index }),
      },
    ),
  );
  samples.push(...heartbeats.map(({ sample }) => sample));

  const playbackCreates = await batches(20, 10, () =>
    measured(
      'playback-create',
      `${input.baseUrl}/me/lessons/${input.lessonId}/playback-sessions`,
      [201, 409],
      {
        method: 'POST',
        headers: { ...studentHeaders, 'idempotency-key': randomUUID() },
      },
    ),
  );
  samples.push(...playbackCreates.map(({ sample }) => sample));

  const uploads = await batches(4, 4, (index) =>
    measured(
      'owner-upload-initiation',
      `${input.baseUrl}/owner/lessons/${input.lessonId}/video-uploads`,
      [201],
      {
        method: 'POST',
        headers: {
          ...ownerHeaders,
          'content-type': 'application/json',
          'idempotency-key': randomUUID(),
        },
        body: JSON.stringify({
          filename: `load-${index}.mp4`,
          mimeType: 'video/mp4',
          sizeBytes: 1_048_576,
        }),
      },
    ),
  );
  samples.push(...uploads.map(({ sample }) => sample));
  for (const { body } of uploads) {
    const uploadUrl = (body as { uploadUrl?: unknown }).uploadUrl;
    if (typeof uploadUrl !== 'string')
      throw new Error(
        'Owner upload load response did not contain a direct URL',
      );
    const uploadOrigin = new URL(uploadUrl).origin;
    if (uploadOrigin === new URL(input.baseUrl).origin)
      throw new Error('Video bytes would traverse the NestJS API');
  }

  const ffmpegMilliseconds = await runFfmpegCapacityProbe();
  const p95 = percentile(
    samples.map(({ milliseconds }) => milliseconds),
    0.95,
  );
  const serverErrors = samples.filter(({ status }) => status >= 500).length;
  if (serverErrors !== 0)
    throw new Error(`Load gate observed ${serverErrors} server errors`);
  if (p95 > 2_000)
    throw new Error(`Load gate p95 ${p95.toFixed(1)}ms exceeded 2000ms`);
  process.stdout.write(
    `Phase 7 load gate passed: ${samples.length} HTTP operations, p95 ${p95.toFixed(1)}ms, zero 5xx, direct-to-storage uploads, FFmpeg probe ${ffmpegMilliseconds.toFixed(1)}ms.\n`,
  );
}
