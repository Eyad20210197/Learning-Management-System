import { join } from 'node:path';
import {
  createTemporaryDirectory,
  downloadFile,
  latestManifestKey,
  loadBackupConfig,
  readManifest,
  removeTemporaryDirectory,
  sha256,
} from './backup/backup-support';
import { restoreEncryptedDump } from './backup/postgres-backup';

async function main(): Promise<void> {
  const config = loadBackupConfig();
  const target = config.restoreDatabaseUrl;
  if (target === undefined)
    throw new Error('BACKUP_RESTORE_DATABASE_URL is required');
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (
    !databaseName.startsWith('lms_restore_') &&
    process.env.BACKUP_ALLOW_IN_PLACE_RESTORE !== 'true'
  ) {
    throw new Error(
      'Restore target must begin with lms_restore_; set BACKUP_ALLOW_IN_PLACE_RESTORE=true only for an approved recovery',
    );
  }
  const manifestKey =
    process.argv
      .find((argument) => argument.startsWith('--manifest='))
      ?.slice(11) ?? (await latestManifestKey(config));
  const manifest = await readManifest(config, manifestKey);
  const directory = await createTemporaryDirectory();
  try {
    const encryptedPath = join(directory, 'database.dump.enc');
    await downloadFile(config, manifest.encryptedObjectKey, encryptedPath);
    if ((await sha256(encryptedPath)) !== manifest.sha256)
      throw new Error('Encrypted backup checksum does not match its manifest');
    await restoreEncryptedDump(config, encryptedPath, directory, target);
    process.stdout.write(
      `Backup from ${manifest.createdAt} restored successfully.\n`,
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
