# LMS production and incident runbook

## Deployment boundary

Cloudflare terminates TLS and proxies `/api/*` to the Nginx origin. `/media/*` is bound to the TypeScript media Worker and must never reach Nginx or NestJS. Nginx denies `/media/*` at the origin as a second boundary. PostgreSQL, Redis, R2, and the origin have no public administrative ports.

Deploy an immutable image digest, never a mutable tag. Run the `migrate` service once before rolling API and worker replicas. Verify `/health/live`, then `/health/ready`, then one authenticated owner and student smoke test. Roll back the application image when needed; never roll back an already-applied database migration. Forward-only migrations must remain compatible with the previous application release during a rolling deployment.

## TLS and Cloudflare

- Set Cloudflare SSL/TLS mode to **Full (strict)** and install a Cloudflare Origin CA or publicly trusted certificate at the edge-to-origin hop.
- Enable Always Use HTTPS, TLS 1.2 minimum, HSTS only after HTTPS recovery has been tested, and authenticated origin pulls or an equivalent origin firewall allowlist.
- Route `example.com/media/*` to the media Worker and bind only the private `MEDIA_BUCKET` plus the media-lease public key.
- Route `example.com/api/*` to Nginx. Never expose ports 3000, PostgreSQL, Redis, MinIO/R2 administration, or the Worker development server.
- Restrict the R2 CORS policy to the deployed frontend origin and required methods/headers. R2 buckets remain private.

## Secret management

Store application secrets in the deployment platform secret store, injected only at runtime. Use separate credentials for the application R2 bucket and backup R2 bucket. The backup principal needs access only to the backup bucket. The media Worker receives the media public key—not the private key, database URL, refresh secret, or backup key.

Rotate JWT, refresh, SMTP, R2, and backup credentials independently. Rotation procedure: add the new credential, deploy consumers, validate, revoke the old credential, and document the event. A media signing-key rotation requires temporarily accepting the previous public key or waiting for the 90-second lease window before revocation. Never put secret values in Compose files, shell history, logs, tickets, or source control.

Run `npm run security:secrets` before every release. If a secret is committed, revoke it immediately; deleting it from Git does not make it safe.

## Health, logs, and alerting

`/api/v1/health/live` proves the process event loop serves requests. `/api/v1/health/ready` checks PostgreSQL, Redis, and BullMQ with bounded timeouts. Remove an instance from traffic when readiness fails; restart only when liveness fails or the process crashes.

Containers emit structured JSON logs to stdout/stderr. The production Compose `local` logging driver rotates at 20 MiB with ten files per container. A production log collector must ship logs off-host with access control and a documented retention policy; never ingest authorization, cookies, passwords, tokens, signed URLs, R2 keys, or raw request bodies.

Alert on:

| Signal | Warning | Critical | First response |
| --- | --- | --- | --- |
| API readiness | 2 failures / 2 min | 5 min unavailable | Identify PostgreSQL, Redis, or queue indicator; fail over or restore dependency |
| HTTP 5xx | >1% for 5 min | >5% for 5 min | Correlate request IDs and rollback recent release |
| Queue waiting age | >5 min | >15 min | Check worker count, Redis, and FFmpeg capacity |
| Queue failed jobs | 1 terminal failure | >5 in 10 min | Inspect safe error code, source validity, and worker logs; retry only recoverable jobs |
| Worker stalled event | 1 | >3 in 10 min | Check CPU/disk/tmp space and terminate wedged tool processes safely |
| PostgreSQL disk | 75% | 85% | Expand disk and confirm backup freshness |
| Backup age | >26 h | >48 h | Run backup, diagnose R2/credentials, and verify restore |
| Restore verification | any failure | two consecutive failures | Freeze destructive releases and repair backup chain |
| Security events | HIGH | CRITICAL | Revoke sessions/devices, preserve audit evidence, investigate source |

## PostgreSQL backup and restore

Run `npm run backup:create` daily from an isolated maintenance job. It creates a custom-format `pg_dump`, encrypts it locally with AES-256-GCM, uploads the encrypted payload and SHA-256 manifest to a separate private R2 bucket, and retains at least `BACKUP_MIN_COPIES` even when older than `BACKUP_RETENTION_DAYS`.

Run `npm run backup:verify` at least weekly. It restores the latest backup into a disposable `lms_restore_*` database, verifies migration history and table structure, and drops the database. Successful upload alone is not a valid backup signal.

For an incident restore, provision a new empty `lms_restore_*` database, set `BACKUP_RESTORE_DATABASE_URL`, and run `npm run backup:restore`. Validate counts and application smoke tests before changing traffic. In-place restore is refused unless `BACKUP_ALLOW_IN_PLACE_RESTORE=true` is explicitly supplied during an approved recovery window.

R2 object versioning/lifecycle rules are defense in depth, not a replacement for the application retention verifier. Store `BACKUP_ENCRYPTION_KEY` in a separate recovery secret vault; losing it makes backups unrecoverable.

## Incident checklist

1. Declare severity, owner, timestamp, and affected boundary.
2. Preserve request IDs, structured logs, audit logs, security events, queue/job IDs, and deployment digest.
3. Contain: remove unhealthy instances, revoke compromised sessions/credentials, or pause uploads/workers.
4. Recover using a known image and, if necessary, a verified backup.
5. Validate readiness plus the affected owner/student/playback workflow.
6. Document cause, customer impact, timeline, corrective work, and secret rotations.
