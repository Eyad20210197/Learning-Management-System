export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface StudentSupportView {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
  };
  devices: Array<{
    id: string;
    clientDeviceId: string;
    name: string;
    browser: string | null;
    operatingSystem: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
  }>;
  authSessions: Array<{
    id: string;
    deviceId: string;
    lastSeenAt: Date;
    revokedAt: Date | null;
    revokeReason: string | null;
    createdAt: Date;
  }>;
  enrollments: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    status: string;
    startsAt: Date;
    expiresAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }>;
  playbackSessions: Array<{
    id: string;
    lessonId: string;
    lessonTitle: string;
    videoId: string;
    deviceId: string;
    status: string;
    lastHeartbeatAt: Date;
    endedAt: Date | null;
    lastPositionSeconds: number;
    createdAt: Date;
  }>;
}

export interface VideoOperationView {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  status: string;
  sourceFilename: string;
  sourceSizeBytes: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  isCurrent: boolean;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
  uploads: Array<{
    id: string;
    status: string;
    expectedSizeBytes: string;
    completedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
  }>;
  processingJobs: Array<{
    id: string;
    status: string;
    attempt: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  variants: Array<{
    id: string;
    status: string;
    width: number;
    height: number;
    bitrateKbps: number;
    sizeBytes: string | null;
  }>;
}

export interface AuditLogView {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface SecurityEventView {
  id: string;
  userId: string | null;
  userEmail: string | null;
  deviceId: string | null;
  type: string;
  severity: string;
  metadata: unknown;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface OperationsSummaryView {
  students: number;
  activeEnrollments: number;
  publishedCourses: number;
  videosProcessing: number;
  videosProcessed: number;
  videosFailed: number;
  activePlaybackSessions: number;
  unresolvedSecurityEvents: number;
  generatedAt: Date;
}
