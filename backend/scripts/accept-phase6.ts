import { randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import argon2 from 'argon2';
import { ApiModule } from '../apps/api/src/api.module';
import { configureApi } from '../apps/api/src/bootstrap/configure-api';
import { ExpireEnrollmentsUseCase } from '../libs/learning/src/application';
import { CleanupExpiredIdempotencyKeysUseCase } from '../libs/operations/src/application';
import { PrismaService } from '../libs/platform/src/database';

interface HttpResult<T> {
  status: number;
  body: T;
}

interface AuthBody {
  accessToken: string;
  user: { id: string };
  device: { id: string };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const suffix = randomUUID();
  const ownerEmail = `phase6-owner-${suffix}@example.test`;
  const studentEmail = `phase6-student-${suffix}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const fixtureUserIds: string[] = [];
  let fixtureCourseId: string | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

  try {
    app = await NestFactory.create(ApiModule, { logger: ['error'] });
    configureApi(app, app.get(ConfigService));
    await app.listen(0, '127.0.0.1');
    const baseUrl = `${await app.getUrl()}/api/v1`;
    const prisma = app.get(PrismaService);

    const call = async <T>(
      path: string,
      expectedStatus: number,
      options: RequestInit = {},
      accessToken?: string,
    ): Promise<HttpResult<T>> => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
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
      if (response.status !== expectedStatus) {
        throw new Error(
          `${options.method ?? 'GET'} ${path} returned ${response.status}: ${JSON.stringify(body)}`,
        );
      }
      return { status: response.status, body };
    };

    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'OWNER' },
      select: { id: true },
    });
    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: await argon2.hash(password),
        firstName: 'Phase',
        lastName: 'Owner',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: ownerRole.id } },
      },
    });
    fixtureUserIds.push(owner.id);

    const ownerAuth = (
      await call<AuthBody>('/auth/login', 200, {
        method: 'POST',
        body: JSON.stringify({
          email: ownerEmail,
          password,
          device: {
            clientDeviceId: randomUUID(),
            name: 'Phase 6 owner acceptance',
          },
        }),
      })
    ).body;

    const registered = (
      await call<{ id: string }>('/auth/register', 201, {
        method: 'POST',
        body: JSON.stringify({
          email: studentEmail,
          password,
          firstName: 'Phase',
          lastName: 'Student',
        }),
      })
    ).body;
    fixtureUserIds.push(registered.id);

    const studentAuth = (
      await call<AuthBody>('/auth/login', 200, {
        method: 'POST',
        body: JSON.stringify({
          email: studentEmail,
          password,
          device: {
            clientDeviceId: randomUUID(),
            name: 'Phase 6 student acceptance',
            browser: 'Acceptance',
            operatingSystem: 'Test',
          },
        }),
      })
    ).body;

    const profile = (
      await call<{ firstName: string }>(
        '/me',
        200,
        { method: 'PATCH', body: JSON.stringify({ firstName: 'Updated' }) },
        studentAuth.accessToken,
      )
    ).body;
    assert(profile.firstName === 'Updated', 'Profile update was not persisted');

    const course = await prisma.course.create({
      data: {
        title: 'Phase 6 acceptance course',
        slug: `phase-6-acceptance-${suffix}`,
        description: 'Temporary acceptance fixture',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    fixtureCourseId = course.id;
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: registered.id,
        courseId: course.id,
        grantedByUserId: owner.id,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const myCourses = (
      await call<{ items: Array<{ id: string }> }>(
        '/me/courses',
        200,
        {},
        studentAuth.accessToken,
      )
    ).body;
    assert(
      myCourses.items.some(({ id }) => id === course.id),
      'Active enrollment was absent from My Courses',
    );

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await app.get(ExpireEnrollmentsUseCase).execute(new Date());
    assert(expired >= 1, 'Enrollment maintenance did not expire the fixture');

    await prisma.idempotencyKey.create({
      data: {
        actorUserId: owner.id,
        scope: 'phase6.acceptance',
        key: suffix,
        requestHash: 'acceptance',
        createdAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const cleaned = await app
      .get(CleanupExpiredIdempotencyKeysUseCase)
      .execute(new Date());
    assert(cleaned >= 1, 'Expired idempotency maintenance did not run');

    await prisma.auditLog.create({
      data: {
        actorUserId: owner.id,
        action: 'phase6.acceptance',
        targetType: 'course',
        targetId: course.id,
        metadata: {
          safe: 'visible',
          accessToken: 'must-not-leak',
          signedUrl: 'https://storage.test/object?signature=must-not-leak',
        },
      },
    });
    await prisma.securityEvent.create({
      data: {
        userId: registered.id,
        deviceId: studentAuth.device.id,
        type: 'PHASE6_ACCEPTANCE',
        severity: 'WARNING',
        metadata: { password: 'must-not-leak', safe: 'visible' },
      },
    });

    const support = (
      await call<Record<string, unknown>>(
        `/owner/students/${registered.id}`,
        200,
        {},
        ownerAuth.accessToken,
      )
    ).body;
    const supportJson = JSON.stringify(support);
    assert(
      !supportJson.includes('ipAddress'),
      'Support view leaked IP metadata',
    );
    assert(
      !supportJson.includes('userAgent'),
      'Support view leaked user-agent metadata',
    );
    assert(
      supportJson.includes('EXPIRED'),
      'Support view missed expired enrollment state',
    );

    await call('/owner/videos?limit=1', 200, {}, ownerAuth.accessToken);
    const audits = (
      await call<{ items: unknown[] }>(
        '/owner/audit-logs?action=phase6.acceptance',
        200,
        {},
        ownerAuth.accessToken,
      )
    ).body;
    const auditJson = JSON.stringify(audits);
    assert(
      audits.items.length === 1,
      'Audit filter did not return the fixture',
    );
    assert(
      !auditJson.includes('must-not-leak'),
      'Audit metadata leaked a secret',
    );
    assert(auditJson.includes('[REDACTED]'), 'Audit metadata was not redacted');

    const security = (
      await call<{ items: unknown[] }>(
        '/owner/security-events?severity=WARNING&unresolvedOnly=true',
        200,
        {},
        ownerAuth.accessToken,
      )
    ).body;
    assert(
      security.items.length >= 1,
      'Security view missed the unresolved event',
    );
    assert(
      !JSON.stringify(security).includes('must-not-leak'),
      'Security metadata leaked a secret',
    );

    const summary = (
      await call<{ students: number; publishedCourses: number }>(
        '/owner/operations/summary',
        200,
        {},
        ownerAuth.accessToken,
      )
    ).body;
    assert(summary.students >= 1, 'Summary missed the student fixture');
    assert(summary.publishedCourses >= 1, 'Summary missed the course fixture');

    await call('/owner/operations/summary', 403, {}, studentAuth.accessToken);

    process.stdout.write(
      'Phase 6 acceptance passed: profile, My Courses, expiry, cleanup, owner support, video operations, audit/security redaction, summary, and RBAC.\n',
    );
  } finally {
    if (app !== undefined) {
      const prisma = app.get(PrismaService);
      if (fixtureUserIds.length > 0) {
        await prisma.securityEvent.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { actorUserId: { in: fixtureUserIds } },
        });
        await prisma.idempotencyKey.deleteMany({
          where: { actorUserId: { in: fixtureUserIds } },
        });
        await prisma.enrollment.deleteMany({
          where: {
            OR: [
              { userId: { in: fixtureUserIds } },
              { grantedByUserId: { in: fixtureUserIds } },
            ],
          },
        });
        await prisma.refreshToken.deleteMany({
          where: { session: { userId: { in: fixtureUserIds } } },
        });
        await prisma.authSession.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.device.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
        await prisma.userRole.deleteMany({
          where: { userId: { in: fixtureUserIds } },
        });
      }
      if (fixtureCourseId !== undefined) {
        await prisma.course.delete({ where: { id: fixtureCourseId } });
      }
      if (fixtureUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
      }
      await app.close();
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
