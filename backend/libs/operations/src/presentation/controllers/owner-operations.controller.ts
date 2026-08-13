import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenGuard,
  PermissionGuard,
  RequirePermissions,
} from '@lms/identity';
import {
  GetOperationsSummaryUseCase,
  GetStudentSupportUseCase,
  ListAuditLogsUseCase,
  ListSecurityEventsUseCase,
  ListVideoOperationsUseCase,
} from '../../application';
import {
  AuditLogQueryDto,
  SecurityEventQueryDto,
  VideoOperationsQueryDto,
} from '../dto/operations-query.dto';
import { OperationsPresenter } from '../presenters/operations.presenter';

@Controller({ path: 'owner', version: '1' })
@UseGuards(AccessTokenGuard, PermissionGuard)
export class OwnerOperationsController {
  constructor(
    private readonly getStudentSupport: GetStudentSupportUseCase,
    private readonly listVideos: ListVideoOperationsUseCase,
    private readonly listAudits: ListAuditLogsUseCase,
    private readonly listSecurity: ListSecurityEventsUseCase,
    private readonly getSummary: GetOperationsSummaryUseCase,
    private readonly presenter: OperationsPresenter,
  ) {}

  @Get('students/:studentId')
  @RequirePermissions('user.read')
  async student(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.presenter.student(
      await this.getStudentSupport.execute(studentId),
    );
  }

  @Get('videos')
  @RequirePermissions('video.read')
  async videos(@Query() query: VideoOperationsQueryDto) {
    return this.presenter.videos(await this.listVideos.execute(query));
  }

  @Get('audit-logs')
  @RequirePermissions('audit.read')
  async audits(@Query() query: AuditLogQueryDto) {
    return this.presenter.audits(await this.listAudits.execute(query));
  }

  @Get('security-events')
  @RequirePermissions('security.read')
  async security(@Query() query: SecurityEventQueryDto) {
    return this.presenter.security(await this.listSecurity.execute(query));
  }

  @Get('operations/summary')
  @RequirePermissions('audit.read')
  async summary() {
    return this.presenter.summary(await this.getSummary.execute());
  }
}
