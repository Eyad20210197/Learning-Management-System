import type {
  CourseView,
  EnrollmentStatus,
  EnrollmentView,
  LessonProgressView,
  LessonType,
  LessonView,
  SectionView,
  StudentSummaryView,
} from '../../domain';

export interface CourseWriteInput {
  title: string;
  slug: string;
  description: string;
}
export interface SectionWriteInput {
  title: string;
  description?: string | null;
}
export interface LessonWriteInput {
  title: string;
  description?: string | null;
  type: LessonType;
  textContent?: string | null;
}
export interface EnrollmentWriteInput {
  userId: string;
  startsAt: Date;
  expiresAt?: Date | null;
  status?: Extract<EnrollmentStatus, 'ACTIVE' | 'SUSPENDED'>;
}

export interface LearningRepositoryPort {
  listPublishedCourses(): Promise<CourseView[]>;
  getPublishedCourseBySlug(slug: string): Promise<CourseView | null>;
  listOwnerCourses(): Promise<CourseView[]>;
  getOwnerCourse(courseId: string): Promise<CourseView | null>;
  listCourseEnrollments(courseId: string): Promise<EnrollmentView[]>;
  searchStudents(query: string | undefined): Promise<StudentSummaryView[]>;
  createCourse(input: CourseWriteInput): Promise<CourseView>;
  updateCourse(
    courseId: string,
    input: CourseWriteInput,
  ): Promise<CourseView | null>;
  publishCourse(courseId: string): Promise<CourseView | null>;
  archiveCourse(courseId: string): Promise<CourseView | null>;
  createSection(
    courseId: string,
    input: SectionWriteInput,
  ): Promise<SectionView | null>;
  updateSection(
    sectionId: string,
    input: SectionWriteInput,
  ): Promise<SectionView | null>;
  reorderSections(courseId: string, ids: string[]): Promise<boolean>;
  createLesson(
    sectionId: string,
    input: LessonWriteInput,
  ): Promise<LessonView | null>;
  updateLesson(
    lessonId: string,
    input: LessonWriteInput,
  ): Promise<LessonView | null>;
  reorderLessons(sectionId: string, ids: string[]): Promise<boolean>;
  grantEnrollment(
    courseId: string,
    actorUserId: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView | null>;
  updateEnrollment(
    enrollmentId: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView | null>;
  revokeEnrollment(
    enrollmentId: string,
    actorUserId: string,
  ): Promise<EnrollmentView | null>;
  listMyCourses(userId: string, now: Date): Promise<CourseView[]>;
  getAuthorizedCourse(
    userId: string,
    courseId: string,
    now: Date,
  ): Promise<CourseView | null>;
  getAuthorizedLesson(
    userId: string,
    lessonId: string,
    now: Date,
  ): Promise<LessonView | null>;
  getEnrollmentForCourse(
    userId: string,
    courseId: string,
  ): Promise<{
    status: EnrollmentStatus;
    startsAt: Date;
    expiresAt: Date | null;
  } | null>;
  getEnrollmentForLesson(
    userId: string,
    lessonId: string,
  ): Promise<{
    status: EnrollmentStatus;
    startsAt: Date;
    expiresAt: Date | null;
  } | null>;
  upsertProgress(
    userId: string,
    lessonId: string,
    input: { positionSeconds: number; watchedSeconds: number },
  ): Promise<LessonProgressView>;
}

export const LEARNING_REPOSITORY = Symbol('learning.repository');
