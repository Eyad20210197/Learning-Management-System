import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '@lms/platform';
import { withDependencyTimeout } from './dependency-timeout';

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy(): Promise<HealthIndicatorResult<'database'>> {
    const check = this.indicator.check('database');

    try {
      await withDependencyTimeout(this.prisma.ping(), 'Database');
      return check.up();
    } catch (error: unknown) {
      this.logger.warn(
        `Database health check failed: ${this.errorMessage(error)}`,
      );
      return check.down('Database is unavailable');
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
