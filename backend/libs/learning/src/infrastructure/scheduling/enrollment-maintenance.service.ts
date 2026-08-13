import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpireEnrollmentsUseCase } from '../../application';

@Injectable()
export class EnrollmentMaintenanceService {
  constructor(private readonly expireEnrollments: ExpireEnrollmentsUseCase) {}

  @Cron('0 * * * * *', { waitForCompletion: true })
  async expireAccessWindows(): Promise<void> {
    await this.expireEnrollments.execute();
  }
}
