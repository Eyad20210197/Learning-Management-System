import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpireStalePlaybackSessionsUseCase } from '../../application';

@Injectable()
export class PlaybackCleanupService {
  constructor(
    private readonly expireStale: ExpireStalePlaybackSessionsUseCase,
  ) {}

  @Cron('*/30 * * * * *', { waitForCompletion: true })
  async cleanup(): Promise<void> {
    await this.expireStale.execute();
  }
}
