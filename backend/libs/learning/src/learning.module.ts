import { Module } from '@nestjs/common';
import { IdentityModule } from '@lms/identity';
import { OperationsModule } from '@lms/operations';
import { DatabaseModule } from '@lms/platform';
import * as UseCases from './application';
import { LEARNING_REPOSITORY } from './application';
import { PrismaLearningRepository } from './infrastructure';
import {
  CatalogController,
  OwnerLearningController,
  StudentLearningController,
} from './presentation';

const useCases = [
  UseCases.CourseAccessService,
  UseCases.ListPublishedCoursesUseCase,
  UseCases.GetPublishedCourseUseCase,
  UseCases.ListOwnerCoursesUseCase,
  UseCases.GetOwnerCourseUseCase,
  UseCases.ListCourseEnrollmentsUseCase,
  UseCases.SearchStudentsUseCase,
  UseCases.CreateCourseUseCase,
  UseCases.UpdateCourseUseCase,
  UseCases.PublishCourseUseCase,
  UseCases.ArchiveCourseUseCase,
  UseCases.CreateSectionUseCase,
  UseCases.UpdateSectionUseCase,
  UseCases.ReorderSectionsUseCase,
  UseCases.CreateLessonUseCase,
  UseCases.UpdateLessonUseCase,
  UseCases.ReorderLessonsUseCase,
  UseCases.GrantEnrollmentUseCase,
  UseCases.UpdateEnrollmentUseCase,
  UseCases.RevokeEnrollmentUseCase,
  UseCases.ListMyCoursesUseCase,
  UseCases.GetMyCourseUseCase,
  UseCases.GetMyLessonUseCase,
  UseCases.UpdateLessonProgressUseCase,
];

@Module({
  imports: [DatabaseModule, IdentityModule, OperationsModule],
  controllers: [
    CatalogController,
    OwnerLearningController,
    StudentLearningController,
  ],
  providers: [
    ...useCases,
    { provide: LEARNING_REPOSITORY, useClass: PrismaLearningRepository },
  ],
})
export class LearningModule {}
