import { Module } from '@nestjs/common';
import { IdentityModule } from '@lms/identity';
import { DatabaseModule, PlatformSchedulingModule } from '@lms/platform';
import * as Application from './application';
import { OPERATIONS_REPOSITORY } from './application';
import { PrismaOperationsRepository } from './infrastructure';
import { OperationsMaintenanceService } from './infrastructure/scheduling/operations-maintenance.service';
import { OperationsPresenter, OwnerOperationsController } from './presentation';

@Module({
  imports: [DatabaseModule, PlatformSchedulingModule, IdentityModule],
  controllers: [OwnerOperationsController],
  providers: [
    Application.AuditService,
    Application.IdempotencyService,
    Application.SensitiveMetadataSanitizer,
    Application.GetStudentSupportUseCase,
    Application.ListVideoOperationsUseCase,
    Application.ListAuditLogsUseCase,
    Application.ListSecurityEventsUseCase,
    Application.GetOperationsSummaryUseCase,
    Application.CleanupExpiredIdempotencyKeysUseCase,
    OperationsPresenter,
    OperationsMaintenanceService,
    { provide: OPERATIONS_REPOSITORY, useClass: PrismaOperationsRepository },
  ],
  exports: [Application.AuditService, Application.IdempotencyService],
})
export class OperationsModule {}
