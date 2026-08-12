import { Module } from '@nestjs/common';
import { DatabaseModule } from '@lms/platform';
import { AuditService, IdempotencyService } from './application';

@Module({
  imports: [DatabaseModule],
  providers: [AuditService, IdempotencyService],
  exports: [AuditService, IdempotencyService],
})
export class OperationsModule {}
