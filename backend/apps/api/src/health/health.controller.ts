import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { QueueHealthIndicator } from './indicators/queue-health.indicator';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check API dependencies' })
  check(): Promise<HealthCheckResult> {
    return this.ready();
  }

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is alive' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Check API readiness and required dependencies' })
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy(),
      () => this.redis.isHealthy(),
      () => this.queue.isHealthy(),
    ]);
  }
}
