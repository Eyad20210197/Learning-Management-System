import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
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
  const databaseName = `lms_restore_${randomUUID().replaceAll('-', '')}`;
  const adminUrl = new URL(config.databaseUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.searchParams.delete('schema');
  const targetUrl = new URL(config.databaseUrl);
  targetUrl.pathname = `/${databaseName}`;
  targetUrl.searchParams.delete('schema');
  const admin = new Client({ connectionString: adminUrl.toString() });
  const directory = await createTemporaryDirectory();
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const manifestKey = await latestManifestKey(config);
    const manifest = await readManifest(config, manifestKey);
    const encryptedPath = join(directory, 'database.dump.enc');
    await downloadFile(config, manifest.encryptedObjectKey, encryptedPath);
    if ((await sha256(encryptedPath)) !== manifest.sha256)
      throw new Error('Encrypted backup checksum does not match its manifest');
    await restoreEncryptedDump(config, encryptedPath, directory, targetUrl);
    const restored = new Client({ connectionString: targetUrl.toString() });
    try {
      await restored.connect();
      const migrationResult = await restored.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
      );
      const tableResult = await restored.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'",
      );
      const migrations = Number(migrationResult.rows[0]?.count ?? 0);
      const tables = Number(tableResult.rows[0]?.count ?? 0);
      if (migrations === 0 || tables < 10)
        throw new Error('Restored database failed structural verification');
      process.stdout.write(
        `Backup restore verified in disposable database: ${migrations} migrations and ${tables} public tables.\n`,
      );
    } finally {
      await restored.end();
    }
  } finally {
    if (created) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await admin.end().catch(() => undefined);
    await removeTemporaryDirectory(directory);
    config.s3.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
