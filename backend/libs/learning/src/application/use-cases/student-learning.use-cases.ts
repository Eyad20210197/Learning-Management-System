import { Inject, Injectable } from '@nestjs/common';
import type { CourseView, LessonProgressView, LessonView } from '../../domain';
import { ResourceNotFoundError } from '../../domain';
import {
  LEARNING_REPOSITORY,
  type LearningRepositoryPort,
} from '../ports/learning-repository.port';
import { CourseAccessService } from '../services/course-access.service';

@Injectable()
export class ListMyCoursesUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(userId: string): Promise<CourseView[]> {
    return this.repository.listMyCourses(userId, new Date());
  }
}
@Injectable()
export class GetMyCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
    private readonly access: CourseAccessService,
  ) {}
  async execute(userId: string, courseId: string): Promise<CourseView> {
    this.access.assertAccess(
      await this.repository.getEnrollmentForCourse(userId, courseId),
    );
    const item = await this.repository.getAuthorizedCourse(
      userId,
      courseId,
      new Date(),
    );
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class GetMyLessonUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
    private readonly access: CourseAccessService,
  ) {}
  async execute(userId: string, lessonId: string): Promise<LessonView> {
    this.access.assertAccess(
      await this.repository.getEnrollmentForLesson(userId, lessonId),
    );
    const item = await this.repository.getAuthorizedLesson(
      userId,
      lessonId,
      new Date(),
    );
    if (item === null) throw new ResourceNotFoundError();
    return item;
  }
}
@Injectable()
export class UpdateLessonProgressUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
    private readonly access: CourseAccessService,
  ) {}
  async execute(
    userId: string,
    lessonId: string,
    input: { positionSeconds: number; watchedSeconds: number },
  ): Promise<LessonProgressView> {
    this.access.assertAccess(
      await this.repository.getEnrollmentForLesson(userId, lessonId),
    );
    return this.repository.upsertProgress(userId, lessonId, input);
  }
}
