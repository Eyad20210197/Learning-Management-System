export type EnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface EnrollmentView {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  startsAt: Date;
  expiresAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentSummaryView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
}
