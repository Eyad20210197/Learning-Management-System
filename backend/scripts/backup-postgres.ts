import { basename } from 'node:path';
import {
  applyRetention,
  createTemporaryDirectory,
  loadBackupConfig,
  removeTemporaryDirectory,
  uploadFile,
  uploadManifest,
  type BackupManifest,
} from './backup/backup-support';
import { createEncryptedDump } from './backup/postgres-backup';

async function main(): Promise<void> {
  const config = loadBackupConfig();
  const directory = await createTemporaryDirectory();
  try {
    const createdAt = new Date();
    const stamp = createdAt.toISOString().replace(/[:.]/g, '-');
    const baseKey = `${config.prefix}/${stamp}`;
    const encryptedObjectKey = `${baseKey}.dump.enc`;
    const manifestKey = `${baseKey}.manifest.json`;
    const backup = await createEncryptedDump(config, directory);
    const manifest: BackupManifest = {
      version: 1,
      createdAt: createdAt.toISOString(),
      database: decodeURIComponent(config.databaseUrl.pathname.slice(1)),
      encryptedObjectKey,
      sha256: backup.sha256,
      encryption: 'AES-256-GCM',
      format: 'pg_dump-custom',
    };
    await uploadFile(
      config,
      encryptedObjectKey,
      backup.encryptedPath,
      'application/octet-stream',
    );
    await uploadManifest(config, manifestKey, manifest);
    const removed = await applyRetention(config);
    process.stdout.write(
      `Encrypted PostgreSQL backup uploaded as ${basename(encryptedObjectKey)}; ${removed} expired backup(s) removed.\n`,
    );
  } finally {
    await removeTemporaryDirectory(directory);
    config.s3.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
