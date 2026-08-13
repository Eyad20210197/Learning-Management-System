import { Inject, Injectable } from '@nestjs/common';
import { OperationsResourceNotFoundError } from '../../domain';
import {
  OPERATIONS_REPOSITORY,
  type OperationsRepositoryPort,
  type PageQuery,
  type SecuritySeverityFilter,
  type VideoOperationStatus,
} from '../ports';

@Injectable()
export class GetStudentSupportUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  async execute(studentId: string) {
    const result = await this.repository.getStudentSupport(studentId);
    if (result === null) throw new OperationsResourceNotFoundError();
    return result;
  }
}

@Injectable()
export class ListVideoOperationsUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  execute(query: PageQuery & { status?: VideoOperationStatus }) {
    return this.repository.listVideoOperations(query);
  }
}

@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  execute(
    query: PageQuery & {
      action?: string;
      actorUserId?: string;
      targetType?: string;
    },
  ) {
    return this.repository.listAuditLogs(query);
  }
}

@Injectable()
export class ListSecurityEventsUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  execute(
    query: PageQuery & {
      severity?: SecuritySeverityFilter;
      unresolvedOnly?: boolean;
    },
  ) {
    return this.repository.listSecurityEvents(query);
  }
}

@Injectable()
export class GetOperationsSummaryUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  execute() {
    return this.repository.getSummary(new Date());
  }
}

@Injectable()
export class CleanupExpiredIdempotencyKeysUseCase {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepositoryPort,
  ) {}
  execute(now = new Date()): Promise<number> {
    return this.repository.deleteExpiredIdempotencyKeys(now);
  }
}
