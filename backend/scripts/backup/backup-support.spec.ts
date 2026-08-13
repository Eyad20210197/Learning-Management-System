import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decryptBackup, encryptBackup } from './backup-support';

describe('encrypted backup container', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lms-backup-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('round-trips database bytes with authenticated AES-256-GCM', async () => {
    const source = join(directory, 'source.dump');
    const encrypted = join(directory, 'backup.enc');
    const restored = join(directory, 'restored.dump');
    const bytes = randomBytes(4_096);
    const key = randomBytes(32);
    await writeFile(source, bytes);

    await encryptBackup(source, encrypted, key);
    await decryptBackup(encrypted, restored, key);

    expect(await readFile(restored)).toEqual(bytes);
    expect(await readFile(encrypted)).not.toContain(bytes);
  });

  it('rejects a backup encrypted with another key', async () => {
    const source = join(directory, 'source.dump');
    const encrypted = join(directory, 'backup.enc');
    await writeFile(source, randomBytes(256));
    await encryptBackup(source, encrypted, randomBytes(32));

    await expect(
      decryptBackup(
        encrypted,
        join(directory, 'restored.dump'),
        randomBytes(32),
      ),
    ).rejects.toThrow();
  });
});
