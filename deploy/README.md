# Production deployment assets

`compose.production.yaml` is a production-shaped single-origin deployment definition. It intentionally does not provision PostgreSQL, Redis, R2, TLS certificates, or secrets: those are external managed/restricted dependencies supplied through runtime environment injection.

Run migrations as a one-shot release task, then start the API, video worker, and Nginx. Nginx binds only to loopback by default so Cloudflare Tunnel or a host TLS proxy can be the public entrypoint.

See `docs/production-runbook.md` for Cloudflare routing, TLS, secrets, alerts, backup, restore, and incident procedures.
