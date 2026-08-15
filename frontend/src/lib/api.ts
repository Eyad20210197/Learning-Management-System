export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: User;
  device: {
    id: string;
    clientDeviceId: string;
    name: string;
    revoked: boolean;
  };
  accessToken: string;
  accessTokenExpiresIn: number;
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
  courseProgress?: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
  };
};
export type Section = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: Lesson[];
};
export type Lesson = {
  id: string;
  sectionId: string;
  courseId?: string;
  title: string;
  description: string | null;
  type: "VIDEO" | "TEXT";
  textContent: string | null;
  sortOrder: number;
  progress?: Progress | null;
  resources?: Array<{
    id: string;
    title: string;
    filename: string;
    mimeType: string;
    sizeBytes: string;
  }>;
};
export type Progress = {
  lessonId: string;
  lastPositionSeconds: number;
  maximumPositionSeconds: number;
  watchedSeconds: number;
  percentage: number;
  completedAt: string | null;
};
export type PlaybackSession = {
  id: string;
  lessonId: string;
  videoId: string;
  status: string;
  hlsUrl: string;
  sessionCode: string;
  lastPositionSeconds: number;
  heartbeatIntervalSeconds: number;
  leaseExpiresAt?: string;
};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    throw new ApiError(
      response.status,
      message ?? "Something went wrong. Please try again.",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (input: {
    email: string;
    password: string;
    device: { clientDeviceId: string; name: string };
  }) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) =>
    request<User>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  refresh: () =>
    request<Pick<AuthResponse, "accessToken" | "accessTokenExpiresIn">>(
      "/api/v1/auth/refresh",
      { method: "POST" },
    ),
  logout: (token: string) =>
    request<void>("/api/v1/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  me: (token: string) =>
    request<User>("/api/v1/me", {
      headers: { authorization: `Bearer ${token}` },
    }),
};

export const learningApi = {
  myCourses: (token: string) =>
    request<{ items: Course[]; nextCursor: string | null }>(
      "/api/v1/me/courses",
      { headers: { authorization: `Bearer ${token}` } },
    ),
  course: (token: string, id: string) =>
    request<Course>(`/api/v1/me/courses/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  lesson: (token: string, id: string) =>
    request<Lesson>(`/api/v1/me/lessons/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  downloadResource: (token: string, resourceId: string) =>
    request<{
      id: string;
      title: string;
      filename: string;
      mimeType: string;
      sizeBytes: string;
      downloadUrl: string;
      expiresIn: number;
    }>(`/api/v1/me/lesson-resources/${resourceId}/download`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  progress: (
    token: string,
    id: string,
    input: { positionSeconds: number; watchedSeconds: number },
  ) =>
    request<Progress>(`/api/v1/me/lessons/${id}/progress`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
  createPlayback: (token: string, lessonId: string) =>
    request<PlaybackSession>(
      `/api/v1/me/lessons/${lessonId}/playback-sessions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID(),
        },
      },
    ),
  heartbeat: (token: string, sessionId: string, positionSeconds: number) =>
    request<PlaybackSession>(
      `/api/v1/me/playback-sessions/${sessionId}/heartbeat`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ positionSeconds }),
      },
    ),
  endPlayback: (token: string, sessionId: string) =>
    request<void>(`/api/v1/me/playback-sessions/${sessionId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  catalog: () =>
    request<{ items: Course[]; nextCursor: string | null }>(
      "/api/v1/catalog/courses",
    ),
};

export const ownerApi = {
  courses: (token: string) =>
    request<{ items: Course[]; nextCursor: string | null }>(
      "/api/v1/owner/courses",
      { headers: { authorization: `Bearer ${token}` } },
    ),
  course: (token: string, id: string) =>
    request<Course>(`/api/v1/owner/courses/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  createCourse: (
    token: string,
    input: { title: string; slug: string; description: string },
  ) =>
    request<Course>("/api/v1/owner/courses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    }),
  updateCourse: (
    token: string,
    id: string,
    input: { title: string; slug: string; description: string },
  ) =>
    request<Course>(`/api/v1/owner/courses/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
  publishCourse: (token: string, id: string) =>
    request<Course>(`/api/v1/owner/courses/${id}/publish`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  archiveCourse: (token: string, id: string) =>
    request<Course>(`/api/v1/owner/courses/${id}/archive`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  createSection: (
    token: string,
    courseId: string,
    input: { title: string; description?: string },
  ) =>
    request<Section>(`/api/v1/owner/courses/${courseId}/sections`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    }),
  updateSection: (
    token: string,
    id: string,
    input: { title: string; description?: string },
  ) =>
    request<Section>(`/api/v1/owner/sections/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
  createLesson: (
    token: string,
    sectionId: string,
    input: {
      title: string;
      description?: string;
      type: "VIDEO" | "TEXT";
      textContent?: string;
    },
  ) =>
    request<Lesson>(`/api/v1/owner/sections/${sectionId}/lessons`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    }),
  updateLesson: (
    token: string,
    id: string,
    input: {
      title: string;
      description?: string;
      type: "VIDEO" | "TEXT";
      textContent?: string;
    },
  ) =>
    request<Lesson>(`/api/v1/owner/lessons/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
  reorderSections: (token: string, courseId: string, ids: string[]) =>
    request<void>(`/api/v1/owner/courses/${courseId}/sections/order`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    }),
  reorderLessons: (token: string, sectionId: string, ids: string[]) =>
    request<void>(`/api/v1/owner/sections/${sectionId}/lessons/order`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    }),
  students: (token: string) =>
    request<{ items: User[]; nextCursor: string | null }>(
      "/api/v1/owner/students",
      { headers: { authorization: `Bearer ${token}` } },
    ),
  enrollments: (token: string, courseId: string) =>
    request<{
      items: Array<{
        id: string;
        userId: string;
        status: string;
        startsAt: string;
        expiresAt: string | null;
      }>;
      nextCursor: string | null;
    }>(`/api/v1/owner/courses/${courseId}/enrollments`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  grantEnrollment: (token: string, courseId: string, userId: string) =>
    request(`/api/v1/owner/courses/${courseId}/enrollments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ userId, startsAt: new Date().toISOString() }),
    }),
  revokeEnrollment: (token: string, enrollmentId: string) =>
    request(`/api/v1/owner/enrollments/${enrollmentId}/revoke`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  operationsSummary: (token: string) =>
    request<{
      students: number;
      activeEnrollments: number;
      publishedCourses: number;
      videosProcessing: number;
      videosProcessed: number;
      videosFailed: number;
      activePlaybackSessions: number;
      unresolvedSecurityEvents: number;
      generatedAt: string;
    }>("/api/v1/owner/operations/summary", {
      headers: { authorization: `Bearer ${token}` },
    }),
  videos: (token: string) =>
    request<{
      items: Array<{
        id: string;
        lessonId: string;
        lessonTitle: string;
        courseTitle: string;
        status: string;
        sourceFilename: string;
        sourceSizeBytes: string;
        durationSeconds: number | null;
        isCurrent: boolean;
        createdAt: string;
        processingJobs: Array<{
          status: string;
          attempt: number;
          finishedAt: string | null;
          errorMessage?: string | null;
        }>;
      }>;
      nextCursor: string | null;
    }>("/api/v1/owner/videos", {
      headers: { authorization: `Bearer ${token}` },
    }),
  resources: (token: string) =>
    request<{
      items: Array<{
        id: string;
        lessonId: string;
        lessonTitle: string;
        courseId: string;
        courseTitle: string;
        title: string;
        filename: string;
        mimeType: string;
        sizeBytes: string;
        status: string;
        createdAt: string;
      }>;
      nextCursor: string | null;
    }>("/api/v1/owner/lesson-resources", {
      headers: { authorization: `Bearer ${token}` },
    }),
  retryVideo: (token: string, id: string) =>
    request(`/api/v1/owner/videos/${id}/retry`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  activateVideo: (token: string, lessonId: string, videoId: string) =>
    request(`/api/v1/owner/lessons/${lessonId}/videos/${videoId}/activate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  deleteResource: (token: string, resourceId: string) =>
    request<void>(`/api/v1/owner/lesson-resources/${resourceId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  deleteVideo: (token: string, videoId: string) =>
    request<void>(`/api/v1/owner/videos/${videoId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  deleteLesson: (token: string, lessonId: string) =>
    request<void>(`/api/v1/owner/lessons/${lessonId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  deleteSection: (token: string, sectionId: string) =>
    request<void>(`/api/v1/owner/sections/${sectionId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  initiateVideoUpload: (
    token: string,
    lessonId: string,
    input: { filename: string; mimeType: string; sizeBytes: number },
  ) =>
    request<{
      id: string;
      videoId: string;
      uploadUrl: string | null;
      uploadMode: "SINGLE" | "MULTIPART";
      partSizeBytes: number | null;
    }>(`/api/v1/owner/lessons/${lessonId}/video-uploads`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(input),
    }),
  completeVideoUpload: (token: string, uploadId: string) =>
    request(`/api/v1/owner/video-uploads/${uploadId}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
    }),
  multipartPart: (token: string, uploadId: string, partNumber: number) =>
    request<{ uploadUrl: string }>(
      `/api/v1/owner/video-uploads/${uploadId}/parts/${partNumber}`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } },
    ),
  multipartComplete: (
    token: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) =>
    request(`/api/v1/owner/video-uploads/${uploadId}/multipart-complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ parts }),
    }),
  initiateResourceUpload: (
    token: string,
    lessonId: string,
    input: {
      title: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) =>
    request<{ id: string; uploadUrl: string }>(
      `/api/v1/owner/lessons/${lessonId}/resources`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      },
    ),
  completeResourceUpload: (token: string, resourceId: string) =>
    request(`/api/v1/owner/lesson-resources/${resourceId}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
};
