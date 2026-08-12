process.env.NODE_ENV = 'test';
process.env.API_PORT = '3000';
process.env.APP_URL = 'http://localhost:3000';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.API_DOCS_ENABLED = 'false';
process.env.DATABASE_URL =
  'postgresql://lms:lms_local_password@127.0.0.1:5432/lms_test';
process.env.DATABASE_POOL_MAX = '2';
process.env.REDIS_URL = 'redis://127.0.0.1:6379/15';
process.env.VIDEO_QUEUE_PREFIX = 'lms-test';
