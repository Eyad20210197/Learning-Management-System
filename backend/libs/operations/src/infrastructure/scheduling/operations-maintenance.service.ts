import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CleanupExpiredIdempotencyKeysUseCase } from '../../application';

@Injectable()
export class OperationsMaintenanceService {
  constructor(
    private readonly cleanupIdempotency: CleanupExpiredIdempotencyKeysUseCase,
  ) {}

  @Cron('0 5 * * * *', { waitForCompletion: true })
  async cleanupExpiredKeys(): Promise<void> {
    await this.cleanupIdempotency.execute();
  }
}
