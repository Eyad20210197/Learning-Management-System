import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type {
  CourseWriteInput,
  EnrollmentWriteInput,
  LearningRepositoryPort,
  LessonWriteInput,
  SectionWriteInput,
} from '../application';
import type {
  CourseView,
  EnrollmentView,
  LessonProgressView,
  LessonView,
  SectionView,
} from '../domain';
import { SlugAlreadyExistsError } from '../domain';

const courseInclude = {
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      lessons: {
        orderBy: { sortOrder: 'asc' as const },
        include: { resources: { orderBy: { createdAt: 'asc' as const } } },
      },
    },
  },
};

interface LessonRecord {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  type: LessonView['type'];
  textContent: string | null;
  sortOrder: number;
}

interface ResourceRecord {
  id: string;
  lessonId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: bigint;
  createdAt: Date;
}

@Injectable()
export class PrismaLearningRepository implements LearningRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedCourses(): Promise<CourseView[]> {
    return (
      await this.prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
    ).map((record) => this.toCourse(record));
  }
  async getPublishedCourseBySlug(slug: string): Promise<CourseView | null> {
    const record = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    return record && this.toCourse(record);
  }
  async listOwnerCourses(): Promise<CourseView[]> {
    return (
      await this.prisma.course.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map((record) => this.toCourse(record));
  }
  async getOwnerCourse(id: string): Promise<CourseView | null> {
    const record = await this.prisma.course.findUnique({
      where: { id },
      include: courseInclude,
    });
    return record === null ? null : this.courseWithCurriculum(record);
  }
  async listCourseEnrollments(courseId: string): Promise<EnrollmentView[]> {
    return (
      await this.prisma.enrollment.findMany({
        where: { courseId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map((record) => this.toEnrollment(record));
  }
  async searchStudents(query: string | undefined) {
    const normalized = query?.trim();
    const records = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { name: 'STUDENT' } } },
        ...(normalized
          ? {
              OR: [
                {
                  email: { contains: normalized, mode: 'insensitive' as const },
                },
                {
                  firstName: {
                    contains: normalized,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  lastName: {
                    contains: normalized,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
      },
    });
    return records;
  }
  async createCourse(input: CourseWriteInput): Promise<CourseView> {
    try {
      return this.toCourse(
        await this.prisma.course.create({ data: this.courseData(input) }),
      );
    } catch (error) {
      this.rethrowSlug(error);
      throw error;
    }
  }
  async updateCourse(
    id: string,
    input: CourseWriteInput,
  ): Promise<CourseView | null> {
    try {
      const updated = await this.prisma.course.updateMany({
        where: { id, status: { not: 'ARCHIVED' } },
        data: this.courseData(input),
      });
      return updated.count === 0
        ? null
        : this.toCourse(
            await this.prisma.course.findUniqueOrThrow({ where: { id } }),
          );
    } catch (error) {
      this.rethrowSlug(error);
      throw error;
    }
  }
  async publishCourse(id: string): Promise<CourseView | null> {
    return this.prisma.$transaction(async (tx) => {
      const valid = await tx.course.findFirst({
        where: {
          id,
          status: 'DRAFT',
          sections: { some: { lessons: { some: {} } } },
        },
        select: { id: true },
      });
      if (!valid) return null;
      return this.toCourse(
        await tx.course.update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        }),
      );
    });
  }
  async archiveCourse(id: string): Promise<CourseView | null> {
    const updated = await this.prisma.course.updateMany({
      where: { id, status: { in: ['DRAFT', 'PUBLISHED'] } },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    return updated.count === 0
      ? null
      : this.toCourse(
          await this.prisma.course.findUniqueOrThrow({ where: { id } }),
        );
  }

  async createSection(
    courseId: string,
    input: SectionWriteInput,
  ): Promise<SectionView | null> {
    return this.prisma.$transaction(async (tx) => {
      if (
        !(await tx.course.findUnique({
          where: { id: courseId },
          select: { id: true },
        }))
      )
        return null;
      const maximum = await tx.courseSection.aggregate({
        where: { courseId },
        _max: { sortOrder: true },
      });
      return this.toSection(
        await tx.courseSection.create({
          data: {
            courseId,
            ...this.sectionData(input),
            sortOrder: (maximum._max.sortOrder ?? -1) + 1,
          },
        }),
        [],
      );
    });
  }
  async updateSection(
    id: string,
    input: SectionWriteInput,
  ): Promise<SectionView | null> {
    const updated = await this.prisma.courseSection.updateMany({
      where: { id },
      data: this.sectionData(input),
    });
    if (!updated.count) return null;
    const record = await this.prisma.courseSection.findUniqueOrThrow({
      where: { id },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toSection(
      record,
      record.lessons.map((lesson) => this.toLesson(lesson)),
    );
  }
  reorderSections(courseId: string, ids: string[]): Promise<boolean> {
    return this.reorder('section', courseId, ids);
  }
  async createLesson(
    sectionId: string,
    input: LessonWriteInput,
  ): Promise<LessonView | null> {
    return this.prisma.$transaction(async (tx) => {
      if (
        !(await tx.courseSection.findUnique({
          where: { id: sectionId },
          select: { id: true },
        }))
      )
        return null;
      const maximum = await tx.lesson.aggregate({
        where: { sectionId },
        _max: { sortOrder: true },
      });
      return this.toLesson(
        await tx.lesson.create({
          data: {
            sectionId,
            ...this.lessonData(input),
            sortOrder: (maximum._max.sortOrder ?? -1) + 1,
          },
        }),
      );
    });
  }
  async updateLesson(
    id: string,
    input: LessonWriteInput,
  ): Promise<LessonView | null> {
    const updated = await this.prisma.lesson.updateMany({
      where: { id },
      data: this.lessonData(input),
    });
    return updated.count === 0
      ? null
      : this.toLesson(
          await this.prisma.lesson.findUniqueOrThrow({ where: { id } }),
        );
  }
  reorderLessons(sectionId: string, ids: string[]): Promise<boolean> {
    return this.reorder('lesson', sectionId, ids);
  }

  async grantEnrollment(
    courseId: string,
    actorUserId: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView | null> {
    if (
      !(await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      }))
    )
      return null;
    try {
      const item = await this.prisma.enrollment.create({
        data: {
          courseId,
          grantedByUserId: actorUserId,
          ...this.enrollmentData(input),
        },
      });
      return this.toEnrollment(item);
    } catch (error) {
      if (this.isUnique(error)) return null;
      throw error;
    }
  }
  async updateEnrollment(
    id: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView | null> {
    const changed = await this.prisma.enrollment.updateMany({
      where: { id, status: { not: 'REVOKED' } },
      data: this.enrollmentData(input),
    });
    return changed.count === 0
      ? null
      : this.toEnrollment(
          await this.prisma.enrollment.findUniqueOrThrow({ where: { id } }),
        );
  }
  async revokeEnrollment(
    id: string,
    _actorUserId: string,
  ): Promise<EnrollmentView | null> {
    void _actorUserId;
    const changed = await this.prisma.enrollment.updateMany({
      where: { id, status: { not: 'REVOKED' } },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (!changed.count) return null;
    return this.toEnrollment(
      await this.prisma.enrollment.findUniqueOrThrow({ where: { id } }),
    );
  }

  async listMyCourses(userId: string, now: Date): Promise<CourseView[]> {
    const items = await this.prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        enrollments: {
          some: {
            userId,
            status: 'ACTIVE',
            startsAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
    return items.map((record) => this.toCourse(record));
  }
  async getAuthorizedCourse(
    userId: string,
    courseId: string,
    now: Date,
  ): Promise<CourseView | null> {
    const record = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        status: 'PUBLISHED',
        enrollments: { some: this.activeEnrollment(userId, now) },
      },
      include: courseInclude,
    });
    return record && this.courseWithCurriculum(record);
  }
  async getAuthorizedLesson(
    userId: string,
    lessonId: string,
    now: Date,
  ): Promise<LessonView | null> {
    const record = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        section: {
          course: {
            status: 'PUBLISHED',
            enrollments: { some: this.activeEnrollment(userId, now) },
          },
        },
      },
      include: {
        progress: { where: { userId }, take: 1 },
        resources: { orderBy: { createdAt: 'asc' } },
      },
    });
    return (
      record &&
      this.toLesson(
        record,
        record.progress[0] ? this.toProgress(record.progress[0]) : null,
        record.resources,
      )
    );
  }
  async getEnrollmentForCourse(userId: string, courseId: string) {
    return this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true, startsAt: true, expiresAt: true },
    });
  }
  async getEnrollmentForLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    return lesson
      ? this.getEnrollmentForCourse(userId, lesson.section.courseId)
      : null;
  }
  async upsertProgress(
    userId: string,
    lessonId: string,
    input: { positionSeconds: number; watchedSeconds: number },
  ): Promise<LessonProgressView> {
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    const maximum = Math.max(
      existing?.maximumPositionSeconds ?? 0,
      input.positionSeconds,
    );
    const watched = Math.max(
      existing?.watchedSeconds ?? 0,
      input.watchedSeconds,
    );
    const percentage = Math.min(
      100,
      Math.round((watched / Math.max(maximum, 1)) * 10000) / 100,
    );
    const completedAt =
      percentage >= 90 ? (existing?.completedAt ?? new Date()) : null;
    return this.toProgress(
      await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: {
          userId,
          lessonId,
          lastPositionSeconds: input.positionSeconds,
          maximumPositionSeconds: maximum,
          watchedSeconds: watched,
          percentage,
          completedAt,
        },
        update: {
          lastPositionSeconds: input.positionSeconds,
          maximumPositionSeconds: maximum,
          watchedSeconds: watched,
          percentage,
          completedAt,
        },
      }),
    );
  }

  async expireEnrollments(now: Date): Promise<number> {
    const result = await this.prisma.enrollment.updateMany({
      where: {
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  private async reorder(
    kind: 'section' | 'lesson',
    parentId: string,
    ids: string[],
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const records =
        kind === 'section'
          ? await tx.courseSection.findMany({
              where: { courseId: parentId },
              select: { id: true },
            })
          : await tx.lesson.findMany({
              where: { sectionId: parentId },
              select: { id: true },
            });
      if (
        records.length !== ids.length ||
        new Set(ids).size !== ids.length ||
        records.some(({ id }) => !ids.includes(id))
      )
        return false;
      const offset = ids.length + 1000;
      if (kind === 'section') {
        await tx.courseSection.updateMany({
          where: { courseId: parentId },
          data: { sortOrder: { increment: offset } },
        });
        for (const [sortOrder, id] of ids.entries())
          await tx.courseSection.update({ where: { id }, data: { sortOrder } });
      } else {
        await tx.lesson.updateMany({
          where: { sectionId: parentId },
          data: { sortOrder: { increment: offset } },
        });
        for (const [sortOrder, id] of ids.entries())
          await tx.lesson.update({ where: { id }, data: { sortOrder } });
      }
      return true;
    });
  }
  private activeEnrollment(userId: string, now: Date) {
    return {
      userId,
      status: 'ACTIVE' as const,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }
  private courseData(input: CourseWriteInput) {
    return {
      title: input.title.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description.trim(),
    };
  }
  private sectionData(input: SectionWriteInput) {
    return {
      title: input.title.trim(),
      description: input.description?.trim() || null,
    };
  }
  private lessonData(input: LessonWriteInput) {
    return {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      textContent: input.type === 'TEXT' ? input.textContent?.trim() : null,
    };
  }
  private enrollmentData(input: EnrollmentWriteInput) {
    return {
      userId: input.userId,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt ?? null,
      status: input.status ?? ('ACTIVE' as const),
    };
  }
  private toCourse = (
    record: {
      id: string;
      title: string;
      slug: string;
      description: string;
      status: CourseView['status'];
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    sections?: SectionView[],
  ): CourseView => ({ ...record, ...(sections ? { sections } : {}) });
  private toSection(
    record: {
      id: string;
      courseId: string;
      title: string;
      description: string | null;
      sortOrder: number;
    },
    lessons: LessonView[],
  ): SectionView {
    return { ...record, lessons };
  }
  private toLesson = (
    record: LessonRecord,
    progress?: LessonProgressView | null,
    resources?: ResourceRecord[],
  ): LessonView => ({
    ...record,
    ...(progress !== undefined ? { progress } : {}),
    ...(resources !== undefined
      ? {
          resources: resources.map((resource) => ({
            ...resource,
            sizeBytes: resource.sizeBytes.toString(),
          })),
        }
      : {}),
  });
  private courseWithCurriculum(
    record: Parameters<typeof this.toCourse>[0] & {
      sections: Array<{
        id: string;
        courseId: string;
        title: string;
        description: string | null;
        sortOrder: number;
        lessons: Array<LessonRecord & { resources: ResourceRecord[] }>;
      }>;
    },
  ): CourseView {
    return this.toCourse(
      record,
      record.sections.map((section) =>
        this.toSection(
          section,
          section.lessons.map((lesson) =>
            this.toLesson(lesson, undefined, lesson.resources),
          ),
        ),
      ),
    );
  }
  private toEnrollment(record: {
    id: string;
    userId: string;
    courseId: string;
    status: EnrollmentView['status'];
    startsAt: Date;
    expiresAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): EnrollmentView {
    return record;
  }
  private toProgress(record: {
    lessonId: string;
    lastPositionSeconds: number;
    maximumPositionSeconds: number;
    watchedSeconds: number;
    percentage: { toString(): string };
    completedAt: Date | null;
  }): LessonProgressView {
    return {
      lessonId: record.lessonId,
      lastPositionSeconds: record.lastPositionSeconds,
      maximumPositionSeconds: record.maximumPositionSeconds,
      watchedSeconds: record.watchedSeconds,
      percentage: Number(record.percentage),
      completedAt: record.completedAt,
    };
  }
  private isUnique(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
  private rethrowSlug(error: unknown): void {
    if (this.isUnique(error)) throw new SlugAlreadyExistsError();
  }
}
