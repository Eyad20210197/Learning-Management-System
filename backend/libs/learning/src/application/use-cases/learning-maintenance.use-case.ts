import { Inject, Injectable } from '@nestjs/common';
import {
  LEARNING_REPOSITORY,
  type LearningRepositoryPort,
} from '../ports/learning-repository.port';

@Injectable()
export class ExpireEnrollmentsUseCase {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepositoryPort,
  ) {}

  execute(now = new Date()): Promise<number> {
    return this.repository.expireEnrollments(now);
  }
}
