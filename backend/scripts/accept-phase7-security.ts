import { randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import argon2 from 'argon2';
import { ApiModule } from '../apps/api/src/api.module';
import { configureApi } from '../apps/api/src/bootstrap/configure-api';
import { PrismaService, RedisService } from '../libs/platform/src';
import { runPhase7Load } from './load/phase7-load';

interface AuthBody {
  accessToken: string;
  user: { id: string };
  device: { id: string };
}

interface PlaybackBody {
  id: string;
  hlsUrl: string;
  lastPositionSeconds: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function cleanupAcceptanceFixtures(
  prisma: PrismaService,
  redis: RedisService,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'phase7-' } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const courses = await prisma.course.findMany({
    where: { slug: { startsWith: 'phase-7-security-' } },
    select: { id: true },
  });
  const courseIds = courses.map(({ id }) => id);
  const lessons = await prisma.lesson.findMany({
    where: { section: { courseId: { in: courseIds } } },
    select: { id: true },
  });
  const lessonIds = lessons.map(({ id }) => id);
  const videos = await prisma.video.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true },
  });
  const videoIds = videos.map(({ id }) => id);
  const sessions = await prisma.playbackSession.findMany({
    where: { OR: [{ userId: { in: userIds } }, { videoId: { in: videoIds } }] },
    select: { id: true, userId: true },
  });
  const sessionIds = sessions.map(({ id }) => id);
  const redisKeys = [
    ...new Set(sessions.map(({ userId }) => `lms:playback:active:${userId}`)),
    ...sessionIds.map((id) => `lms:playback:session:${id}`),
  ];
  if (redisKeys.length > 0) await redis.client.del(...redisKeys);
  await prisma.playbackEvent.deleteMany({
    where: { playbackSessionId: { in: sessionIds } },
  });
  await prisma.playbackSession.deleteMany({
    where: { id: { in: sessionIds } },
  });
  await prisma.lessonProgress.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { lessonId: { in: lessonIds } }],
    },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { actorUserId: { in: userIds } },
  });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.securityEvent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.enrollment.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { grantedByUserId: { in: userIds } },
        { courseId: { in: courseIds } },
      ],
    },
  });
  await prisma.videoProcessingJob.deleteMany({
    where: { videoId: { in: videoIds } },
  });
  await prisma.videoUpload.deleteMany({ where: { videoId: { in: videoIds } } });
  await prisma.videoVariant.deleteMany({
    where: { videoId: { in: videoIds } },
  });
  await prisma.videoAsset.deleteMany({ where: { videoId: { in: videoIds } } });
  await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  await prisma.lessonResource.deleteMany({
    where: { lessonId: { in: lessonIds } },
  });
  await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
  await prisma.courseSection.deleteMany({
    where: { courseId: { in: courseIds } },
  });
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.oneTimeToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.refreshToken.deleteMany({
    where: { session: { userId: { in: userIds } } },
  });
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main(): Promise<void> {
  const suffix = randomUUID();
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const userIds: string[] = [];
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    app = await NestFactory.create(ApiModule, { logger: false });
    configureApi(app, app.get(ConfigService));
    await app.listen(0, '127.0.0.1');
    const baseUrl = `${await app.getUrl()}/api/v1`;
    const prisma = app.get(PrismaService);
    await cleanupAcceptanceFixtures(prisma, app.get(RedisService));

    const call = async <T>(
      path: string,
      expected: number,
      accessToken?: string,
      options: RequestInit = {},
    ): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: AbortSignal.timeout(10_000),
        headers: {
          ...(options.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
          ...(accessToken === undefined
            ? {}
            : { authorization: `Bearer ${accessToken}` }),
          ...options.headers,
        },
      });
      const body = (
        response.status === 204 ? undefined : await response.json()
      ) as T;
      if (response.status !== expected)
        throw new Error(
          `${options.method ?? 'GET'} ${path}: expected ${expected}, received ${response.status} ${JSON.stringify(body)}`,
        );
      return body;
    };

    const roleIds = Object.fromEntries(
      (
        await prisma.role.findMany({
          where: { name: { in: ['OWNER', 'STUDENT'] } },
          select: { id: true, name: true },
        })
      ).map(({ id, name }) => [name, id]),
    );
    assert(roleIds.OWNER !== undefined, 'OWNER role is missing');
    assert(roleIds.STUDENT !== undefined, 'STUDENT role is missing');

    const createUser = async (role: 'OWNER' | 'STUDENT', label: string) => {
      const user = await prisma.user.create({
        data: {
          email: `phase7-${label}-${suffix}@example.test`,
          passwordHash: await argon2.hash(password),
          firstName: 'Phase',
          lastName: label,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: { roleId: roleIds[role]! } },
        },
      });
      userIds.push(user.id);
      return user;
    };
    const owner = await createUser('OWNER', 'owner');
    const student = await createUser('STUDENT', 'student');
    const outsider = await createUser('STUDENT', 'outsider');

    const login = async (email: string, deviceId: string, name: string) =>
      call<AuthBody>('/auth/login', 200, undefined, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          device: { clientDeviceId: deviceId, name },
        }),
      });
    const ownerAuth = await login(owner.email, randomUUID(), 'Owner security');
    const firstAuth = await login(student.email, randomUUID(), 'Student first');
    const secondAuth = await login(
      student.email,
      randomUUID(),
      'Student second',
    );
    const outsiderAuth = await login(
      outsider.email,
      randomUUID(),
      'Outsider security',
    );

    const course = await prisma.course.create({
      data: {
        title: 'Phase 7 security course',
        slug: `phase-7-security-${suffix}`,
        description: 'Temporary security fixture',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        sections: {
          create: {
            title: 'Security section',
            sortOrder: 0,
            lessons: {
              create: {
                title: 'Protected lesson',
                type: 'VIDEO',
                sortOrder: 0,
              },
            },
          },
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    const lessonId = course.sections[0]?.lessons[0]?.id;
    assert(lessonId !== undefined, 'Lesson fixture was not created');
    const videoId = randomUUID();
    await prisma.video.create({
      data: {
        id: videoId,
        lessonId,
        status: 'READY',
        sourceFilename: 'security.mp4',
        sourceSizeBytes: 1_024n,
        durationSeconds: 300,
        width: 1280,
        height: 720,
        videoCodec: 'h264',
        audioCodec: 'aac',
        isCurrent: true,
        assets: {
          create: {
            type: 'HLS_MASTER',
            storageKey: `processed/${videoId}/hls/master.m3u8`,
            mimeType: 'application/vnd.apple.mpegurl',
            sizeBytes: 128n,
          },
        },
        variants: {
          create: {
            status: 'READY',
            width: 1280,
            height: 720,
            bitrateKbps: 2800,
            videoCodec: 'h264',
            audioCodec: 'aac',
            playlistKey: `processed/${videoId}/hls/720p/index.m3u8`,
            sizeBytes: 1_024n,
          },
        },
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        grantedByUserId: owner.id,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await call(`/me/lessons/${lessonId}`, 200, firstAuth.accessToken);
    await call(`/me/lessons/${lessonId}`, 403, outsiderAuth.accessToken);
    await call('/owner/operations/summary', 403, firstAuth.accessToken);

    await call(`/me/lessons/${lessonId}/progress`, 200, firstAuth.accessToken, {
      method: 'PUT',
      body: JSON.stringify({
        positionSeconds: 42,
        watchedSeconds: 42,
      }),
    });

    const firstPlayback = await call<PlaybackBody>(
      `/me/lessons/${lessonId}/playback-sessions`,
      201,
      firstAuth.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );
    assert(
      firstPlayback.hlsUrl === `/media/hls/${videoId}/master.m3u8`,
      'Playback response exposed an unexpected or permanent media path',
    );
    assert(
      firstPlayback.lastPositionSeconds === 42,
      'Playback did not resume from persisted lesson progress',
    );
    const secondPlayback = await call<PlaybackBody>(
      `/me/lessons/${lessonId}/playback-sessions`,
      201,
      secondAuth.accessToken,
      { method: 'POST', headers: { 'idempotency-key': randomUUID() } },
    );
    await call(
      `/me/playback-sessions/${firstPlayback.id}/heartbeat`,
      409,
      firstAuth.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 15 }) },
    );
    await call(
      `/me/playback-sessions/${secondPlayback.id}/heartbeat`,
      200,
      secondAuth.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 30 }) },
    );

    await runPhase7Load({
      baseUrl,
      ownerToken: ownerAuth.accessToken,
      studentToken: secondAuth.accessToken,
      courseSlug: course.slug,
      lessonId,
      playbackSessionId: secondPlayback.id,
    });
    await call(
      `/me/playback-sessions/${secondPlayback.id}/heartbeat`,
      404,
      outsiderAuth.accessToken,
      { method: 'POST', body: JSON.stringify({ positionSeconds: 30 }) },
    );

    await call(
      `/owner/lessons/${lessonId}/video-uploads`,
      400,
      ownerAuth.accessToken,
      {
        method: 'POST',
        headers: { 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          filename: 'malware.exe',
          mimeType: 'application/octet-stream',
          sizeBytes: 1,
        }),
      },
    );

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await call(`/me/lessons/${lessonId}`, 403, firstAuth.accessToken);

    await call(
      `/me/devices/${secondAuth.device.id}`,
      204,
      firstAuth.accessToken,
      { method: 'DELETE' },
    );
    await call('/me', 401, secondAuth.accessToken);

    const storageUrl = app
      .get(ConfigService)
      .getOrThrow<string>('storage.endpoint');
    const direct = await fetch(
      `${storageUrl.replace('127.0.0.1', 'localhost')}/lms-private/processed/${videoId}/hls/master.m3u8`,
      { signal: AbortSignal.timeout(5_000) },
    );
    assert(
      direct.status === 403 || direct.status === 404,
      `Private storage returned unexpected public status ${direct.status}`,
    );

    const serialized = JSON.stringify({ firstPlayback, secondPlayback });
    for (const forbidden of [
      'storageKey',
      'playlistKey',
      'accessKey',
      'secret',
      'uploadUrl',
    ]) {
      assert(!serialized.includes(forbidden), `Playback leaked ${forbidden}`);
    }

    process.stdout.write(
      'Phase 7 security acceptance passed: IDOR, owner RBAC, enrollment expiry, device revocation, invalid uploads, playback replacement/ownership, private storage, and response secrecy.\n',
    );
  } finally {
    if (app !== undefined) {
      await cleanupAcceptanceFixtures(
        app.get(PrismaService),
        app.get(RedisService),
      );
      await app.close();
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
