import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpireVideoUploadsUseCase } from '../../application';
import { ExpireLessonResourcesUseCase } from '../../application';

@Injectable()
export class UploadCleanupService {
  constructor(
    private readonly expireUploads: ExpireVideoUploadsUseCase,
    private readonly expireResources: ExpireLessonResourcesUseCase,
  ) {}

  @Cron('0 */15 * * * *', {
    name: 'expire-video-uploads',
    waitForCompletion: true,
  })
  async clean(): Promise<void> {
    await this.expireUploads.execute();
    await this.expireResources.execute();
  }
}
