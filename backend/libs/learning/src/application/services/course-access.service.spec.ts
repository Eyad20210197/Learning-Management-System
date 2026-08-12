import {
  CourseAccessDeniedError,
  EnrollmentExpiredError,
  EnrollmentNotStartedError,
} from '../../domain';
import { CourseAccessService } from './course-access.service';

describe('CourseAccessService', () => {
  const now = new Date('2026-08-12T12:00:00Z');
  const service = new CourseAccessService();

  it('allows only an active enrollment inside its access window', () => {
    expect(() =>
      service.assertAccess(
        {
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00Z'),
          expiresAt: new Date('2026-09-01T00:00:00Z'),
        },
        now,
      ),
    ).not.toThrow();
  });

  it('denies absent, suspended, and revoked enrollment states', () => {
    expect(() => service.assertAccess(null, now)).toThrow(
      CourseAccessDeniedError,
    );
    expect(() =>
      service.assertAccess(
        { status: 'SUSPENDED', startsAt: now, expiresAt: null },
        now,
      ),
    ).toThrow(CourseAccessDeniedError);
  });

  it('distinguishes future and expired access windows', () => {
    expect(() =>
      service.assertAccess(
        {
          status: 'ACTIVE',
          startsAt: new Date('2026-08-13T00:00:00Z'),
          expiresAt: null,
        },
        now,
      ),
    ).toThrow(EnrollmentNotStartedError);
    expect(() =>
      service.assertAccess(
        {
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00Z'),
          expiresAt: new Date('2026-08-12T12:00:00Z'),
        },
        now,
      ),
    ).toThrow(EnrollmentExpiredError);
  });
});
