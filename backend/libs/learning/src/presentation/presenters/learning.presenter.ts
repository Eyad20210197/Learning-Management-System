import type {
  CourseView,
  EnrollmentView,
  LessonProgressView,
  LessonView,
  SectionView,
  StudentSummaryView,
} from '../../domain';

export class LearningPresenter {
  static course(course: CourseView): Record<string, unknown> {
    return {
      ...course,
      publishedAt: course.publishedAt?.toISOString() ?? null,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      ...(course.sections
        ? { sections: course.sections.map(this.section) }
        : {}),
    };
  }
  static section = (section: SectionView): Record<string, unknown> => ({
    ...section,
    lessons: section.lessons.map(LearningPresenter.lesson),
  });
  static lesson = (lesson: LessonView): Record<string, unknown> => ({
    ...lesson,
    ...(lesson.progress !== undefined
      ? {
          progress: lesson.progress
            ? LearningPresenter.progress(lesson.progress)
            : null,
        }
      : {}),
    ...(lesson.resources !== undefined
      ? {
          resources: lesson.resources.map((resource) => ({
            ...resource,
            createdAt: resource.createdAt.toISOString(),
          })),
        }
      : {}),
  });
  static enrollment(enrollment: EnrollmentView): Record<string, unknown> {
    return {
      ...enrollment,
      startsAt: enrollment.startsAt.toISOString(),
      expiresAt: enrollment.expiresAt?.toISOString() ?? null,
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      createdAt: enrollment.createdAt.toISOString(),
      updatedAt: enrollment.updatedAt.toISOString(),
    };
  }
  static progress(progress: LessonProgressView): Record<string, unknown> {
    return {
      ...progress,
      completedAt: progress.completedAt?.toISOString() ?? null,
    };
  }
  static student(student: StudentSummaryView): Record<string, unknown> {
    return { ...student, createdAt: student.createdAt.toISOString() };
  }
}
