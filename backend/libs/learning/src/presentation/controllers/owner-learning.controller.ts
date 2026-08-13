import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenGuard,
  PermissionGuard,
  RequirePermissions,
} from '@lms/identity';
import { AuditService, IdempotencyService } from '@lms/operations';
import type { Request } from 'express';
import {
  ArchiveCourseUseCase,
  CreateCourseUseCase,
  CreateLessonUseCase,
  CreateSectionUseCase,
  GrantEnrollmentUseCase,
  GetOwnerCourseUseCase,
  ListCourseEnrollmentsUseCase,
  ListOwnerCoursesUseCase,
  PublishCourseUseCase,
  ReorderLessonsUseCase,
  ReorderSectionsUseCase,
  RevokeEnrollmentUseCase,
  SearchStudentsUseCase,
  UpdateCourseUseCase,
  UpdateEnrollmentUseCase,
  UpdateLessonUseCase,
  UpdateSectionUseCase,
} from '../../application';
import {
  CourseWriteDto,
  EnrollmentWriteDto,
  LessonWriteDto,
  OrderedIdsDto,
  SectionWriteDto,
  StudentSearchDto,
} from '../dto/learning.dto';
import { LearningPresenter } from '../presenters/learning.presenter';

interface OwnerRequest extends Request {
  auth: { user: { id: string } };
}
@Controller({ path: 'owner', version: '1' })
@UseGuards(AccessTokenGuard, PermissionGuard)
export class OwnerLearningController {
  constructor(
    private readonly listCourses: ListOwnerCoursesUseCase,
    private readonly getCourse: GetOwnerCourseUseCase,
    private readonly listEnrollments: ListCourseEnrollmentsUseCase,
    private readonly searchStudents: SearchStudentsUseCase,
    private readonly createCourse: CreateCourseUseCase,
    private readonly updateCourse: UpdateCourseUseCase,
    private readonly publishCourse: PublishCourseUseCase,
    private readonly archiveCourse: ArchiveCourseUseCase,
    private readonly createSection: CreateSectionUseCase,
    private readonly updateSection: UpdateSectionUseCase,
    private readonly reorderSections: ReorderSectionsUseCase,
    private readonly createLesson: CreateLessonUseCase,
    private readonly updateLesson: UpdateLessonUseCase,
    private readonly reorderLessons: ReorderLessonsUseCase,
    private readonly grantEnrollment: GrantEnrollmentUseCase,
    private readonly updateEnrollment: UpdateEnrollmentUseCase,
    private readonly revokeEnrollment: RevokeEnrollmentUseCase,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}
  @Get('courses') @RequirePermissions('course.read') async courses() {
    return {
      items: (await this.listCourses.execute()).map((course) =>
        LearningPresenter.course(course),
      ),
      nextCursor: null,
    };
  }
  @Get('courses/:courseId')
  @RequirePermissions('course.read')
  async course(@Param('courseId', ParseUUIDPipe) id: string) {
    return LearningPresenter.course(await this.getCourse.execute(id));
  }
  @Get('students')
  @RequirePermissions('user.read')
  async students(@Query() query: StudentSearchDto) {
    return {
      items: (await this.searchStudents.execute(query.query)).map((student) =>
        LearningPresenter.student(student),
      ),
      nextCursor: null,
    };
  }
  @Post('courses')
  @RequirePermissions('course.create')
  @Header('Idempotency-Replayed', 'false')
  async addCourse(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CourseWriteDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: 'course.create',
        key,
        request: dto,
        responseStatus: 201,
        handler: async () => {
          const course = await this.createCourse.execute(dto);
          await this.record(req, 'course.create', 'course', course.id);
          return LearningPresenter.course(course);
        },
      })
    ).value;
  }
  @Patch('courses/:courseId')
  @RequirePermissions('course.update')
  async editCourse(
    @Req() req: OwnerRequest,
    @Param('courseId', ParseUUIDPipe) id: string,
    @Body() dto: CourseWriteDto,
  ) {
    const course = await this.updateCourse.execute(id, dto);
    await this.record(req, 'course.update', 'course', id);
    return LearningPresenter.course(course);
  }
  @Post('courses/:courseId/publish')
  @HttpCode(200)
  @RequirePermissions('course.publish')
  async publish(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('courseId', ParseUUIDPipe) id: string,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `course.publish:${id}`,
        key,
        request: { id },
        responseStatus: 200,
        handler: async () => {
          const course = await this.publishCourse.execute(id);
          await this.record(req, 'course.publish', 'course', id);
          return LearningPresenter.course(course);
        },
      })
    ).value;
  }
  @Post('courses/:courseId/archive')
  @HttpCode(200)
  @RequirePermissions('course.archive')
  async archive(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('courseId', ParseUUIDPipe) id: string,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `course.archive:${id}`,
        key,
        request: { id },
        responseStatus: 200,
        handler: async () => {
          const course = await this.archiveCourse.execute(id);
          await this.record(req, 'course.archive', 'course', id);
          return LearningPresenter.course(course);
        },
      })
    ).value;
  }
  @Post('courses/:courseId/sections')
  @RequirePermissions('curriculum.create')
  async addSection(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('courseId', ParseUUIDPipe) id: string,
    @Body() dto: SectionWriteDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `section.create:${id}`,
        key,
        request: dto,
        responseStatus: 201,
        handler: async () => {
          const section = await this.createSection.execute(id, dto);
          await this.record(req, 'section.create', 'courseSection', section.id);
          return LearningPresenter.section(section);
        },
      })
    ).value;
  }
  @Patch('sections/:sectionId')
  @RequirePermissions('curriculum.update')
  async editSection(
    @Req() req: OwnerRequest,
    @Param('sectionId', ParseUUIDPipe) id: string,
    @Body() dto: SectionWriteDto,
  ) {
    const section = await this.updateSection.execute(id, dto);
    await this.record(req, 'section.update', 'courseSection', id);
    return LearningPresenter.section(section);
  }
  @Put('courses/:courseId/sections/order')
  @HttpCode(204)
  @RequirePermissions('curriculum.reorder')
  async sectionOrder(
    @Req() req: OwnerRequest,
    @Param('courseId', ParseUUIDPipe) id: string,
    @Body() dto: OrderedIdsDto,
  ) {
    await this.reorderSections.execute(id, dto.ids);
    await this.record(req, 'section.reorder', 'course', id);
  }
  @Post('sections/:sectionId/lessons')
  @RequirePermissions('curriculum.create')
  async addLesson(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('sectionId', ParseUUIDPipe) id: string,
    @Body() dto: LessonWriteDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `lesson.create:${id}`,
        key,
        request: dto,
        responseStatus: 201,
        handler: async () => {
          const lesson = await this.createLesson.execute(id, dto);
          await this.record(req, 'lesson.create', 'lesson', lesson.id);
          return LearningPresenter.lesson(lesson);
        },
      })
    ).value;
  }
  @Patch('lessons/:lessonId')
  @RequirePermissions('curriculum.update')
  async editLesson(
    @Req() req: OwnerRequest,
    @Param('lessonId', ParseUUIDPipe) id: string,
    @Body() dto: LessonWriteDto,
  ) {
    const lesson = await this.updateLesson.execute(id, dto);
    await this.record(req, 'lesson.update', 'lesson', id);
    return LearningPresenter.lesson(lesson);
  }
  @Put('sections/:sectionId/lessons/order')
  @HttpCode(204)
  @RequirePermissions('curriculum.reorder')
  async lessonOrder(
    @Req() req: OwnerRequest,
    @Param('sectionId', ParseUUIDPipe) id: string,
    @Body() dto: OrderedIdsDto,
  ) {
    await this.reorderLessons.execute(id, dto.ids);
    await this.record(req, 'lesson.reorder', 'courseSection', id);
  }
  @Get('courses/:courseId/enrollments')
  @RequirePermissions('enrollment.read')
  async enrollments(@Param('courseId', ParseUUIDPipe) id: string) {
    return {
      items: (await this.listEnrollments.execute(id)).map((enrollment) =>
        LearningPresenter.enrollment(enrollment),
      ),
      nextCursor: null,
    };
  }
  @Post('courses/:courseId/enrollments')
  @RequirePermissions('enrollment.create')
  async grant(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('courseId', ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentWriteDto,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `enrollment.create:${id}`,
        key,
        request: dto,
        responseStatus: 201,
        handler: async () => {
          const enrollment = await this.grantEnrollment.execute(
            id,
            req.auth.user.id,
            dto,
          );
          await this.record(
            req,
            'enrollment.grant',
            'enrollment',
            enrollment.id,
          );
          return LearningPresenter.enrollment(enrollment);
        },
      })
    ).value;
  }
  @Patch('enrollments/:enrollmentId')
  @RequirePermissions('enrollment.update')
  async editEnrollment(
    @Req() req: OwnerRequest,
    @Param('enrollmentId', ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentWriteDto,
  ) {
    const enrollment = await this.updateEnrollment.execute(id, dto);
    await this.record(req, 'enrollment.update', 'enrollment', id);
    return LearningPresenter.enrollment(enrollment);
  }
  @Post('enrollments/:enrollmentId/revoke')
  @RequirePermissions('enrollment.revoke')
  async revoke(
    @Req() req: OwnerRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Param('enrollmentId', ParseUUIDPipe) id: string,
  ) {
    return (
      await this.idempotency.execute({
        actorUserId: req.auth.user.id,
        scope: `enrollment.revoke:${id}`,
        key,
        request: { id },
        responseStatus: 200,
        handler: async () => {
          const enrollment = await this.revokeEnrollment.execute(
            id,
            req.auth.user.id,
          );
          await this.record(req, 'enrollment.revoke', 'enrollment', id);
          return LearningPresenter.enrollment(enrollment);
        },
      })
    ).value;
  }

  private record(
    request: OwnerRequest,
    action: string,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    return this.audit.record({
      actorUserId: request.auth.user.id,
      action,
      targetType,
      targetId,
      requestId: typeof request.id === 'string' ? request.id : undefined,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
