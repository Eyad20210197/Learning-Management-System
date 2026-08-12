import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
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

describe('API foundation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(VIDEO_PROCESSING_QUEUE))
      .useValue({ close: jest.fn().mockResolvedValue(undefined) })
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
});
