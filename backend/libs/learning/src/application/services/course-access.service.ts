import { Injectable } from '@nestjs/common';
import type { EnrollmentStatus } from '../../domain';
import {
  CourseAccessDeniedError,
  EnrollmentExpiredError,
  EnrollmentNotStartedError,
} from '../../domain';

@Injectable()
export class CourseAccessService {
  assertAccess(
    enrollment: {
      status: EnrollmentStatus;
      startsAt: Date;
      expiresAt: Date | null;
    } | null,
    now = new Date(),
  ): void {
    if (enrollment === null || enrollment.status !== 'ACTIVE')
      throw new CourseAccessDeniedError();
    if (enrollment.startsAt > now) throw new EnrollmentNotStartedError();
    if (enrollment.expiresAt !== null && enrollment.expiresAt <= now)
      throw new EnrollmentExpiredError();
  }
}
