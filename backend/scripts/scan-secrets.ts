import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const workspace = resolve(__dirname, '../..');
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { cwd: workspace, encoding: 'utf8' },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => !path.endsWith('package-lock.json'))
  .filter((path) => !path.includes('/generated/'))
  .filter((path) => !path.startsWith('backend/dist/'));

const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.mp4',
  '.zip',
]);

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:sk_live|rk_live)_[0-9A-Za-z]{20,}\b/,
  /\b(?:ghp|github_pat)_[0-9A-Za-z_]{20,}\b/,
  /\bCF_API_TOKEN\s*=\s*[^$<{\s][^\s]{15,}/,
] as const;
const configuredSecretAssignment =
  /\b(?:JWT_ACCESS_SECRET|REFRESH_TOKEN_SECRET|MEDIA_LEASE_PRIVATE_KEY|BACKUP_ENCRYPTION_KEY)\s*=\s*(?!replace-|\$\{|<)[^\s]{16,}/;

const findings: string[] = [];
for (const relativePath of files) {
  if (binaryExtensions.has(extname(relativePath).toLowerCase())) continue;
  if (
    /\.env(?:\.|$)/.test(relativePath) &&
    !relativePath.endsWith('.env.example')
  ) {
    findings.push(`${relativePath}: environment files must not be committed`);
    continue;
  }
  let content: string;
  try {
    content = readFileSync(resolve(workspace, relativePath), 'utf8');
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(content))
      findings.push(`${relativePath}: ${pattern.source}`);
  }
  const isTestFixture =
    /(?:^|\/)test(?:\/|$)/.test(relativePath) ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(relativePath);
  if (!isTestFixture && configuredSecretAssignment.test(content)) {
    findings.push(`${relativePath}: ${configuredSecretAssignment.source}`);
  }
}

if (findings.length > 0) {
  process.stderr.write(
    `Potential committed secrets detected:\n${findings.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Secret scan passed across ${files.length} source files.\n`,
  );
}
