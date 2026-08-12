import { Inject, Injectable } from '@nestjs/common';
import type { CourseView } from '../../domain';
import { ResourceNotFoundError } from '../../domain';
import {
  LEARNING_REPOSITORY,
  type LearningRepositoryPort,
} from '../ports/learning-repository.port';

@Injectable()
export class ListPublishedCoursesUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  execute(): Promise<CourseView[]> {
    return this.repository.listPublishedCourses();
  }
}

@Injectable()
export class GetPublishedCourseUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}
  async execute(slug: string): Promise<CourseView> {
    const course = await this.repository.getPublishedCourseBySlug(slug);
    if (course === null) throw new ResourceNotFoundError();
    return course;
  }
}
