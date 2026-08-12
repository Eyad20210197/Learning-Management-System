import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '@lms/identity';
import type { Request } from 'express';
import {
  GetMyCourseUseCase,
  GetMyLessonUseCase,
  ListMyCoursesUseCase,
  UpdateLessonProgressUseCase,
} from '../../application';
import { ProgressDto } from '../dto/learning.dto';
import { LearningPresenter } from '../presenters/learning.presenter';

interface SubjectRequest extends Request {
  auth: { user: { id: string } };
}
@Controller({ path: 'me', version: '1' })
@UseGuards(AccessTokenGuard)
export class StudentLearningController {
  constructor(
    private readonly listCourses: ListMyCoursesUseCase,
    private readonly getCourse: GetMyCourseUseCase,
    private readonly getLesson: GetMyLessonUseCase,
    private readonly updateProgress: UpdateLessonProgressUseCase,
  ) {}
  @Get('courses') async courses(
    @Req() req: SubjectRequest,
  ): Promise<Record<string, unknown>> {
    return {
      items: (await this.listCourses.execute(req.auth.user.id)).map((course) =>
        LearningPresenter.course(course),
      ),
      nextCursor: null,
    };
  }
  @Get('courses/:courseId') async course(
    @Req() req: SubjectRequest,
    @Param('courseId', ParseUUIDPipe) id: string,
  ) {
    return LearningPresenter.course(
      await this.getCourse.execute(req.auth.user.id, id),
    );
  }
  @Get('lessons/:lessonId') async lesson(
    @Req() req: SubjectRequest,
    @Param('lessonId', ParseUUIDPipe) id: string,
  ) {
    return LearningPresenter.lesson(
      await this.getLesson.execute(req.auth.user.id, id),
    );
  }
  @Put('lessons/:lessonId/progress') async progress(
    @Req() req: SubjectRequest,
    @Param('lessonId', ParseUUIDPipe) id: string,
    @Body() dto: ProgressDto,
  ) {
    return LearningPresenter.progress(
      await this.updateProgress.execute(req.auth.user.id, id, dto),
    );
  }
}
