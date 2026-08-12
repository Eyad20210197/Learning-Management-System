import { Inject, Injectable } from '@nestjs/common';
import type {
  CourseView,
  EnrollmentView,
  LessonView,
  SectionView,
  StudentSummaryView,
} from '../../domain';
import {
  InvalidStateTransitionError,
  ResourceNotFoundError,
} from '../../domain';
import {
  LEARNING_REPOSITORY,
  type CourseWriteInput,
  type EnrollmentWriteInput,
  type LearningRepositoryPort,
  type LessonWriteInput,
  type SectionWriteInput,
} from '../ports/learning-repository.port';

@Injectable()
export class ListOwnerCoursesUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(): Promise<CourseView[]> {
    return this.repository.listOwnerCourses();
  }
}

@Injectable()
export class GetOwnerCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string): Promise<CourseView> {
    const course = await this.repository.getOwnerCourse(id);
    if (course === null) throw new ResourceNotFoundError();
    return course;
  }
}

@Injectable()
export class ListCourseEnrollmentsUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(courseId: string): Promise<EnrollmentView[]> {
    return this.repository.listCourseEnrollments(courseId);
  }
}

@Injectable()
export class SearchStudentsUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(query: string | undefined): Promise<StudentSummaryView[]> {
    return this.repository.searchStudents(query);
  }
}

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(input: CourseWriteInput): Promise<CourseView> {
    return this.repository.createCourse(input);
  }
}

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string, input: CourseWriteInput): Promise<CourseView> {
    const course = await this.repository.updateCourse(id, input);
    if (course === null) throw new ResourceNotFoundError();
    return course;
  }
}

@Injectable()
export class PublishCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string): Promise<CourseView> {
    const course = await this.repository.publishCourse(id);
    if (course === null)
      throw new InvalidStateTransitionError(
        'Only a draft course with curriculum can be published.',
      );
    return course;
  }
}

@Injectable()
export class ArchiveCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string): Promise<CourseView> {
    const course = await this.repository.archiveCourse(id);
    if (course === null) throw new InvalidStateTransitionError();
    return course;
  }
}

@Injectable()
export class CreateSectionUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(
    courseId: string,
    input: SectionWriteInput,
  ): Promise<SectionView> {
    const item = await this.repository.createSection(courseId, input);
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class UpdateSectionUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string, input: SectionWriteInput): Promise<SectionView> {
    const item = await this.repository.updateSection(id, input);
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class ReorderSectionsUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(courseId: string, ids: string[]): Promise<void> {
    if (!(await this.repository.reorderSections(courseId, ids)))
      throw new InvalidStateTransitionError(
        'The ordered IDs must contain every course section exactly once.',
      );
  }
}
@Injectable()
export class CreateLessonUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(
    sectionId: string,
    input: LessonWriteInput,
  ): Promise<LessonView> {
    const item = await this.repository.createLesson(sectionId, input);
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class UpdateLessonUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string, input: LessonWriteInput): Promise<LessonView> {
    const item = await this.repository.updateLesson(id, input);
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class ReorderLessonsUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(sectionId: string, ids: string[]): Promise<void> {
    if (!(await this.repository.reorderLessons(sectionId, ids)))
      throw new InvalidStateTransitionError(
        'The ordered IDs must contain every section lesson exactly once.',
      );
  }
}

@Injectable()
export class GrantEnrollmentUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(
    courseId: string,
    actorUserId: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView> {
    const item = await this.repository.grantEnrollment(
      courseId,
      actorUserId,
      input,
    );
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class UpdateEnrollmentUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(
    id: string,
    input: EnrollmentWriteInput,
  ): Promise<EnrollmentView> {
    const item = await this.repository.updateEnrollment(id, input);
    if (item === null) throw new InvalidStateTransitionError();
    return item;
  }
}
@Injectable()
export class RevokeEnrollmentUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(id: string, actorUserId: string): Promise<EnrollmentView> {
    const item = await this.repository.revokeEnrollment(id, actorUserId);
    if (item === null) throw new InvalidStateTransitionError();
    return item;
  }
}
