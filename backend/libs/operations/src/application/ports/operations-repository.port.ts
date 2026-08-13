import type {
  AuditLogView,
  CursorPage,
  OperationsSummaryView,
  SecurityEventView,
  StudentSupportView,
  VideoOperationView,
} from '../../domain';

export interface PageQuery {
  cursor?: string;
  limit: number;
}
export type VideoOperationStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETING'
  | 'DELETED';
export type SecuritySeverityFilter = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface OperationsRepositoryPort {
  getStudentSupport(studentId: string): Promise<StudentSupportView | null>;
  listVideoOperations(
    query: PageQuery & { status?: VideoOperationStatus },
  ): Promise<CursorPage<VideoOperationView>>;
  listAuditLogs(
    query: PageQuery & {
      action?: string;
      actorUserId?: string;
      targetType?: string;
    },
  ): Promise<CursorPage<AuditLogView>>;
  listSecurityEvents(
    query: PageQuery & {
      severity?: SecuritySeverityFilter;
      unresolvedOnly?: boolean;
    },
  ): Promise<CursorPage<SecurityEventView>>;
  getSummary(now: Date): Promise<OperationsSummaryView>;
  deleteExpiredIdempotencyKeys(now: Date): Promise<number>;
}

export const OPERATIONS_REPOSITORY = Symbol('operations.repository');
