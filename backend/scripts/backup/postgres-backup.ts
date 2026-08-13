import { join } from 'node:path';
import {
  decryptBackup,
  encryptBackup,
  runPostgresTool,
  sha256,
  type BackupConfig,
} from './backup-support';

export async function createEncryptedDump(
  config: BackupConfig,
  directory: string,
): Promise<{ encryptedPath: string; sha256: string }> {
  const dumpPath = join(directory, 'database.dump');
  const encryptedPath = join(directory, 'database.dump.enc');
  await runPostgresTool(
    config.pgDumpPath,
    [
      '--format=custom',
      '--compress=6',
      '--no-owner',
      '--no-acl',
      '--file',
      dumpPath,
    ],
    config.databaseUrl,
  );
  await encryptBackup(dumpPath, encryptedPath, config.encryptionKey);
  return { encryptedPath, sha256: await sha256(encryptedPath) };
}

export async function restoreEncryptedDump(
  config: BackupConfig,
  encryptedPath: string,
  directory: string,
  target: URL,
): Promise<void> {
  const dumpPath = join(directory, 'restore.dump');
  await decryptBackup(encryptedPath, dumpPath, config.encryptionKey);
  await runPostgresTool(
    config.pgRestorePath,
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      dumpPath,
    ],
    target,
  );
}
