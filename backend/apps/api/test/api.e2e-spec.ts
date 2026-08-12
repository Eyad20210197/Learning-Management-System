import type { Server } from 'node:http';
import {
  Controller,
  type CanActivate,
  Get,
  type INestApplication,
  type ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  PermissionGuard,
  RegisterStudentUseCase,
  RequirePermissions,
} from '@lms/identity';
import { OBJECT_STORAGE } from '@lms/media';
import {
  PrismaService,
  RedisService,
  VIDEO_PROCESSING_QUEUE,
} from '@lms/platform';
import request from 'supertest';
import { ApiModule } from '../src/api.module';
import { configureApi } from '../src/bootstrap/configure-api';

interface HealthResponseBody {
  status: string;
  info: {
    database: { status: string };
    redis: { status: string };
  };
}

interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
}

interface UserResponseBody {
  id: string;
  email: string;
  roles: string[];
}

class StudentAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      auth?: { permissions: string[] };
    }>();
    request.auth = { permissions: [] };
    return true;
  }
}

@Controller({ path: 'owner/test-authorization', version: '1' })
@UseGuards(StudentAccessGuard, PermissionGuard)
@RequirePermissions('course.write')
class OwnerAuthorizationProbeController {
  @Get()
  probe(): { ok: true } {
    return { ok: true };
  }
}

describe('API foundation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  const registerStudent = jest
    .fn()
    .mockImplementation(
      (input: { email: string; firstName: string; lastName: string }) =>
        Promise.resolve({
          id: '0198d03a-81df-7c0f-9908-e700c1c6744d',
          email: { value: input.email },
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
          roles: ['STUDENT'],
          createdAt: new Date('2026-08-12T00:00:00.000Z'),
          updatedAt: new Date('2026-08-12T00:00:00.000Z'),
        }),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
      controllers: [OwnerAuthorizationProbeController],
      providers: [StudentAccessGuard, PermissionGuard],
    })
      .overrideProvider(PrismaService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(VIDEO_PROCESSING_QUEUE))
      .useValue({ close: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(OBJECT_STORAGE)
      .useValue({
        createUploadUrl: jest.fn(),
        createMultipartUpload: jest.fn(),
        createMultipartPartUrl: jest.fn(),
        completeMultipartUpload: jest.fn(),
        abortMultipartUpload: jest.fn(),
        createDownloadUrl: jest.fn(),
        head: jest.fn(),
        delete: jest.fn(),
      })
      .overrideProvider(RegisterStudentUseCase)
      .useValue({ execute: registerStudent })
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApi(app, app.get(ConfigService));
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports healthy PostgreSQL and Redis dependencies', async () => {
    const response = await request(httpServer)
      .get('/api/v1/health')
      .expect(200);
    const body = response.body as unknown as HealthResponseBody;

    expect(response.headers).toHaveProperty(
      'x-request-id',
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
    expect(body).toMatchObject({
      status: 'ok',
      info: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('wraps framework errors in the stable error envelope', async () => {
    const response = await request(httpServer)
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'not-a-uuid')
      .expect(404);
    const body = response.body as unknown as ErrorResponseBody;
    const responseRequestId: unknown = response.headers['x-request-id'];

    expect(body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /api/v1/does-not-exist',
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(responseRequestId).toBe(body.requestId);
  });

  it('registers a student through the versioned HTTP contract', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'correct horse battery staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .expect(201);
    const body = response.body as unknown as UserResponseBody;

    expect(body).toMatchObject({
      id: '0198d03a-81df-7c0f-9908-e700c1c6744d',
      email: 'student@example.com',
      roles: ['STUDENT'],
    });
    expect(registerStudent).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'correct horse battery staple',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('rejects unknown registration fields before the use case runs', async () => {
    registerStudent.mockClear();

    const response = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'correct horse battery staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
        isOwner: true,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(registerStudent).not.toHaveBeenCalled();
  });

  it('denies a student principal access to owner permissions', async () => {
    const response = await request(httpServer)
      .get('/api/v1/owner/test-authorization')
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_DENIED',
    });
  });
});
