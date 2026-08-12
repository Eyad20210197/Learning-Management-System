import { Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ProcessingWorkspace,
  TemporaryWorkspacePort,
} from '../../application';

@Injectable()
export class TemporaryWorkspaceAdapter implements TemporaryWorkspacePort {
  async create(sourceExtension: string): Promise<ProcessingWorkspace> {
    const rootPath = await mkdtemp(join(tmpdir(), 'lms-video-'));
    const outputPath = join(rootPath, 'output');
    await mkdir(outputPath);
    return {
      rootPath,
      sourcePath: join(rootPath, `source${sourceExtension}`),
      outputPath,
    };
  }

  remove(rootPath: string): Promise<void> {
    return rm(rootPath, { recursive: true, force: true, maxRetries: 3 });
  }
}
