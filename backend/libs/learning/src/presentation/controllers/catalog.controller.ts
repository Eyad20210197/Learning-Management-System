import { Controller, Get, Param } from '@nestjs/common';
import {
  GetPublishedCourseUseCase,
  ListPublishedCoursesUseCase,
} from '../../application';
import { LearningPresenter } from '../presenters/learning.presenter';

@Controller({ path: 'catalog/courses', version: '1' })
export class CatalogController {
  constructor(
    private readonly listCourses: ListPublishedCoursesUseCase,
    private readonly getCourse: GetPublishedCourseUseCase,
  ) {}
  @Get() async list(): Promise<Record<string, unknown>> {
    return {
      items: (await this.listCourses.execute()).map((course) =>
        LearningPresenter.course(course),
      ),
      nextCursor: null,
    };
  }
  @Get(':slug') async get(
    @Param('slug') slug: string,
  ): Promise<Record<string, unknown>> {
    return LearningPresenter.course(await this.getCourse.execute(slug));
  }
}
