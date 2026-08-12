import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';

export class MediaCommandError extends Error {
  constructor(
    readonly executable: string,
    readonly exitCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'MediaCommandError';
  }
}

@Injectable()
export class MediaCommandRunner {
  run(
    executable: string,
    args: readonly string[],
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const append = (current: string, chunk: Buffer): string =>
        (current + chunk.toString('utf8')).slice(-32_768);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = append(stderr, chunk);
      });
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, timeoutMs);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(
          new MediaCommandError(
            executable,
            null,
            `Could not start media command: ${error.message}`,
          ),
        );
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve(stdout);
        else {
          reject(
            new MediaCommandError(
              executable,
              code,
              (
                stderr.trim() ||
                `Media command exited with code ${String(code)}`
              ).slice(-4_000),
            ),
          );
        }
      });
    });
  }
}
