# LMS V1 — JavaScript Implementation Plan

## Status and authority

This is the authoritative v1 implementation plan. It replaces the earlier multi-instructor, TypeScript, and MP4-delivery assumptions in the historical documentation.

The application is a single-owner LMS:

- one `OWNER` creates, publishes, and controls all content and student access;
- `STUDENT` users consume only lessons covered by an active enrollment;
- all application source uses JavaScript (`.js` and `.jsx`), not TypeScript;
- NestJS is the only business, authentication, authorization, and data-access backend;
- video delivery is HLS-only, from private R2 through a Cloudflare Worker media gateway.

## 1. V1 decisions

| Area | Decision |
| --- | --- |
| Roles | Seed only `OWNER` and `STUDENT`. No instructor, administrator, support, or public role-management UI. |
| Backend | Node.js 20+, NestJS in JavaScript, PostgreSQL, Prisma, Redis, BullMQ, FFmpeg/FFprobe. |
| Frontend | React JavaScript, Vite, React Router in SPA mode, TanStack Query, `hls.js` with native HLS fallback. |
| Video | H.264/AAC HLS. Generate at most 360p, 720p, and 1080p; never upscale. |
| Storage | Private Cloudflare R2. Direct presigned URLs are for owner uploads only, never student playback. |
| Playback | Same-origin Cloudflare Worker at `/media/*`, short-lived media lease cookie, one concurrent stream, moving watermark, heartbeats. |
| Auth | Short-lived access token held only in browser memory; rotating refresh cookie; separate scoped media cookie. |
| Enrollment | Manual owner grants in v1. Payments, coupons, subscriptions, and anonymous video previews are deferred. |
| API | REST under `/api/v1`, source-controlled OpenAPI 3.1 contract, stable error codes, generated JavaScript client. |

## 2. Product boundary

### Included

- student registration, login, logout, password reset, and device management;
- owner-created courses, sections, video/text lessons, and protected resources;
- manual enrollment grants, expiry, suspension, and revocation;
- direct R2 video upload, asynchronous inspection/transcoding, HLS delivery, and retry handling;
- secure playback, resume position, completion tracking, device limits, and one concurrent stream;
- owner dashboard for courses, students, enrollments, uploads, and processing status;
- audit logs, health checks, backups, rate limits, security tests, and local development instructions.

### Explicitly excluded from v1

- multiple instructors or course ownership transfer;
- payments, coupons, subscriptions, marketplaces, and affiliates;
- quizzes, assignments, certificates, live sessions, chat, forums, and gamification;
- native mobile apps, DRM, AES HLS encryption, and commercial anti-piracy services;
- public video previews and complex marketing/SEO requirements;
- microservices and separate frontend-backend authentication systems.

## 3. Target architecture

```text
Browser
  |
  +-- / ------------------------> React/Vite static SPA
  |
  +-- /api/v1/* ----------------> Nginx -> NestJS API
  |                                     |        |
  |                                     |        +--> PostgreSQL (permanent records)
  |                                     |        +--> Redis (locks, sessions, limits, BullMQ)
  |                                     |
  |                                     +--> BullMQ worker -> FFprobe / FFmpeg -> private R2
  |
  +-- /media/* -----------------> Cloudflare Worker -> private R2
                                         ^
                                         |
                              validates narrow playback lease
```

The development topology mirrors production as closely as practical:

- React and NestJS run locally;
- PostgreSQL and Redis run through Docker Compose;
- the BullMQ worker runs locally as a separate Node process;
- FFmpeg and FFprobe are installed locally;
- `wrangler dev` runs the media Worker, initially against a test R2 bucket when needed.

The API never streams video bytes in production and never runs FFmpeg in an HTTP request.

## 4. JavaScript standards

### Language and module conventions

- Backend, worker, scripts, and frontend use JavaScript only.
- Use `.js` for Node/NestJS/Worker code and `.jsx` for React components.
- Configure the Nest JavaScript starter's Babel support for decorators; do not introduce `tsconfig.json` or `.ts` files.
- Use ESM consistently where the selected scaffold supports it; do not mix `require()` and `import` in new code.
- Use ESLint and Prettier from the first commit.
- Use JSDoc on public DTO helpers, adapters, complex service arguments, and external integration boundaries. It improves editor assistance without turning the project into TypeScript.

### Runtime guardrails

- Validate all environment variables at startup.
- Validate every HTTP input with Nest DTO validation.
- Keep database schema validation in Prisma migrations, not in handwritten SQL scattered through services.
- Treat OpenAPI request/response schemas and integration tests as the contract boundary that compensates for the lack of compile-time TypeScript checks.

## 5. Repository layout

```text
lms/
├── backend/                     # NestJS JavaScript application
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── courses/
│   │   ├── enrollments/
│   │   ├── uploads/
│   │   ├── videos/
│   │   ├── transcoding/
│   │   ├── playback/
│   │   ├── devices/
│   │   ├── progress/
│   │   ├── audit/
│   │   ├── admin/
│   │   ├── health/
│   │   ├── common/
│   │   └── config/
│   ├── prisma/
│   └── test/
├── frontend/                    # React/Vite JavaScript SPA
│   └── src/
│       ├── app/
│       ├── features/
│       └── shared/
├── media-worker/                # Cloudflare Worker in JavaScript
│   └── src/index.js
├── docs/
│   ├── erd.dbml
│   ├── state-machines.md
│   ├── authorization-matrix.md
│   └── openapi.yaml
├── docker-compose.yml
├── .env.example
└── Documentation/
```

`Documentation/` contains the project planning material. The lower-case `docs/` directory will contain implementation-controlled contracts and generated artifacts.

## 6. Domain model and data rules

### Identity and authorization

```text
users
roles
permissions
user_roles
role_permissions
devices
auth_sessions
refresh_tokens
one_time_tokens
```

- Seed `OWNER` and `STUDENT`, then grant permissions through roles. This keeps RBAC extensible without implementing non-existent staff workflows.
- Create the only owner through a protected seed/CLI command. Never promote the first public registration.
- Normalize email before persistence and enforce a case-insensitive unique constraint.
- `auth_sessions` own refresh-token families. Refresh-token reuse revokes the entire family/session.
- `one_time_tokens` stores hashed, single-use, expiring password-reset tokens and can later support email verification.
- Devices are unique by `(user_id, client_device_uuid)`. IP address is audit metadata, never the device identity.

### Learning and access

```text
courses
course_sections
lessons
lesson_resources
enrollments
lesson_progress
```

- Courses use `DRAFT`, `PUBLISHED`, and `ARCHIVED`; a one-owner product does not need `REVIEW`.
- Lessons begin with `VIDEO` and optional `TEXT`. PDFs are `lesson_resources`, not a separate lesson system.
- Enrollments use `ACTIVE`, `SUSPENDED`, `REVOKED`, and `EXPIRED`. Completion belongs in `completed_at`, not in the access status.
- `starts_at` and `expires_at` on the enrollment are the enforceable access window. Do not silently change existing student access when a course default changes.
- Use unique `(course_id, sort_order)` and `(section_id, sort_order)` constraints. Reorder from an ordered ID list in one transaction.
- `lesson_progress` is unique by `(user_id, lesson_id)` and stores the last position, maximum watched position, calculated percentage, and `completed_at`.

### Video and playback

```text
videos
video_assets
video_variants
video_uploads
video_processing_jobs
playback_sessions
playback_events
```

- Treat uploaded/transcoded videos as immutable versions. A lesson can retain old video versions, but one ready version is current.
- Only activate a replacement after it reaches `READY`; failed work must not break an existing lesson.
- Store source, HLS master playlist, thumbnails, captions, and similar files as typed assets. Do not create database rows for individual HLS segments.
- `playback_sessions.video_id` identifies the exact video version watched.
- Heartbeats update fast state in Redis and periodically persist session/progress state. Do not insert a database event every heartbeat.

### Cross-cutting rules

- Use UUID primary keys, `timestamptz`, explicit foreign keys, and server-generated R2 keys.
- Archive business records; do not hard-delete users, courses, active videos, enrollments, or audit evidence in normal application flows.
- Keep audit logs append-only and omit all passwords, tokens, credentials, R2 keys, and signed URLs.

## 7. Authentication, authorization, and cookie model

### Authentication

1. `POST /api/v1/auth/login` validates credentials, resolves the device, creates an `auth_session`, and returns a short-lived access token.
2. The frontend keeps the access token in memory only and sends it in the `Authorization` header.
3. The API sets a rotating refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie scoped to the API path.
4. `POST /api/v1/auth/refresh` rotates the refresh token and returns a fresh access token.
5. Cookie-authenticated endpoints use origin/CSRF protection. Logout, password changes, and token reuse revoke the appropriate session family.

### Authorization

- NestJS is the final authority for every protected API request. React route guards are only navigation/UX helpers.
- The client never supplies a user ID for student-scoped actions.
- `CourseAccessService` is the only service permitted to authorize protected lesson, resource, progress, and playback access.
- Every owner route requires an `OWNER` permission check and every object lookup verifies its parent relationship to prevent IDOR.

## 8. HLS delivery and playback lease

### Required flow

1. A student calls `POST /api/v1/me/lessons/:lessonId/playback-sessions`.
2. NestJS verifies account status, device status, active enrollment, lesson relationship, video readiness, and concurrent-playback policy.
3. NestJS atomically marks any prior active playback session as `REPLACED`, writes the new session to PostgreSQL and Redis, and returns a clean HLS URL such as `/media/hls/<video-version>/master.m3u8`.
4. NestJS sets an `HttpOnly`, `Secure`, `SameSite` media-lease cookie scoped to `/media`. The signed lease contains the session ID, user ID, device ID, video version, media audience, issue/expiry time, and a random ID.
5. The Cloudflare Worker validates the lease and that the requested object is under the lease's allowed HLS prefix before retrieving it through its private R2 binding.
6. The player sends a heartbeat every 30 seconds. A healthy heartbeat renews a 90-second media lease; a replaced or revoked session receives a stable `PLAYBACK_REPLACED` or `PLAYBACK_REVOKED` error and stops.

### Worker rules

- Keep HLS child references relative and under `/media/hls/<video-version>/...`; the browser therefore presents the cookie for master playlists, variant playlists, initialization files, segments, subtitles, and future keys.
- Derive the R2 key from the validated video version and safe relative path. Never accept an arbitrary R2 key from the request.
- Allow only known HLS output extensions and content types.
- Keep the R2 bucket private: do not enable its `r2.dev` URL or attach a public media custom domain.
- Validate authorization before using any edge cache. If segment caching is enabled later, cache under a canonical object key that excludes the cookie/lease and never bypasses the Worker authorization step.
- Do not serve original upload files to students.
- Do not add AES-128 HLS encryption in v1. It is not DRM and complicates key delivery.

### Local fallback

During early local development, a NestJS media controller may proxy a small test asset to prove the player contract. It is only a development fallback. The production acceptance criterion is the Worker-to-private-R2 path with no video bytes flowing through NestJS.

## 9. API contract

Use `/api/v1` and the following audience boundaries:

```text
/catalog/*  published public metadata only
/me/*       authenticated student/account actions
/owner/*    OWNER-only content, enrollment, upload, and operations actions
```

### Core endpoint groups

```http
# Auth and account
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
POST /auth/password/forgot
POST /auth/password/reset
POST /auth/password/change
GET  /me
PATCH /me
GET  /me/devices
DELETE /me/devices/:deviceId

# Catalogue and learning
GET  /catalog/courses
GET  /catalog/courses/:slug
GET  /me/courses
GET  /me/courses/:courseId
GET  /me/lessons/:lessonId
PUT  /me/lessons/:lessonId/progress
POST /me/lessons/:lessonId/playback-sessions
POST /me/playback-sessions/:sessionId/heartbeat
DELETE /me/playback-sessions/:sessionId

# Owner content and enrollment management
GET   /owner/courses
POST  /owner/courses
PATCH /owner/courses/:courseId
POST  /owner/courses/:courseId/publish
POST  /owner/courses/:courseId/archive
POST  /owner/courses/:courseId/sections
PUT   /owner/courses/:courseId/sections/order
PATCH /owner/sections/:sectionId
POST  /owner/sections/:sectionId/lessons
PUT   /owner/sections/:sectionId/lessons/order
PATCH /owner/lessons/:lessonId
POST  /owner/courses/:courseId/enrollments
PATCH /owner/enrollments/:enrollmentId
POST  /owner/enrollments/:enrollmentId/revoke

# Owner video operations
POST /owner/lessons/:lessonId/video-uploads
POST /owner/video-uploads/:uploadId/complete
GET  /owner/videos/:videoId
POST /owner/videos/:videoId/retry
POST /owner/lessons/:lessonId/videos/:videoId/activate
```

### Contract requirements

- `docs/openapi.yaml` is written before controllers are implemented and reviewed with the ERD.
- Nest Swagger generates a development OpenAPI document; automated tests compare it with the reviewed contract to identify drift.
- The frontend consumes a generated JavaScript API client/helpers rather than duplicating request and response shapes by hand.
- Every mutation that a browser or queue can safely retry uses an `Idempotency-Key`, especially enrollment grants and upload completion.
- All errors use `{ statusCode, code, message, details, requestId }` with stable codes such as `COURSE_ACCESS_DENIED`, `VIDEO_NOT_READY`, `DEVICE_REVOKED`, and `PLAYBACK_REPLACED`.
- List endpoints define pagination, sorting, filtering, and default limits in the OpenAPI contract.

## 10. Implementation phases

### Phase 0 — Freeze contracts

**Build:**

- `docs/erd.dbml` with tables, relations, unique constraints, indexes, and deletion/archive rules;
- `docs/state-machines.md` for enrollment, upload, video processing, and playback sessions;
- `docs/authorization-matrix.md` for `OWNER` and `STUDENT` capabilities;
- `docs/openapi.yaml` for the endpoint groups above;
- `.env.example` listing all required variables without values.

**Done when:** schema, state transitions, permissions, error codes, and endpoint request/response examples have no unresolved contradiction.

### Phase 1 — JavaScript foundation

**Build:**

- scaffold `backend/` with `npx @nestjs/cli@latest new backend --language JS`;
- configure JavaScript linting, formatting, Jest, environment validation, request IDs, structured logging, global exception handling, and `/api/v1/health`;
- add Docker Compose services for PostgreSQL and Redis;
- initialize Prisma, create the first migration, and add a reproducible seed command;
- scaffold `frontend/` as a React JavaScript Vite application and configure SPA fallback routing;
- scaffold `media-worker/` with Wrangler in JavaScript but do not expose any R2 object yet.

**Done when:** a new developer can clone the project, populate local environment values, start all local dependencies, apply migrations, seed the owner, and receive a healthy API response.

### Phase 2 — Identity, devices, and RBAC

**Build:**

- users, roles, permissions, `auth_sessions`, refresh-token rotation, and one-time token persistence;
- Argon2id password hashing; registration, login, refresh, logout, logout-all, password-reset, and password-change flows;
- device registration/revocation and configured device limits;
- permission guard, account-status guard, ownership policies, rate limits, audit service, and security events;
- owner seed/CLI flow.

**Done when:** token reuse revokes the session family; revoked devices/accounts lose access; student calls to owner routes are denied; and identity E2E tests pass.

### Phase 3 — LMS core and access service

**Build:**

- course, section, lesson, resource, enrollment, and progress Prisma models and migrations;
- owner curriculum CRUD and atomic ordering;
- course publication/archive rules;
- manual enrollment create/extend/suspend/revoke flows;
- `CourseAccessService` and student course/curriculum endpoints;
- basic React routes for login, My Courses, course view, and owner course editing.

**Done when:** an owner can create and publish a video lesson placeholder, grant a student access, and the student can see only their permitted course metadata.

### Phase 4 — Private upload and processing pipeline

**Build:**

- private R2 adapter, server-generated object keys, CORS policy, upload validation, and direct signed owner uploads;
- upload records, multipart strategy if required by expected source sizes, idempotent completion, and abandoned-upload cleanup;
- a separate BullMQ worker process; FFprobe inspection; FFmpeg H.264/AAC HLS packaging; asset/variant persistence; retries, error capture, and temp-file cleanup;
- owner processing-status UI and retry operation.

**Done when:** an owner can upload a test video, the worker produces only valid non-upscaled renditions, R2 contains a verified HLS package, and a failed job is visible and retryable.

### Phase 5 — Secure Worker-based playback

**Build:**

- playback session persistence, Redis single-stream lock, replacement logic, and media-lease issuer;
- Cloudflare Worker R2 binding, lease verification, strict path mapping, correct HLS content headers, and denied-request logging;
- media-cookie issue/renew/expiry behavior; heartbeat endpoint; stale-session cleanup;
- React `SecureVideoPlayer` with native HLS fallback, `hls.js`, watermark movement, heartbeat, resume position, error handling, and teardown.

**Done when:** a student plays HLS through `/media/*`; R2 never exposes a public playback URL; a second device replaces the first; the first stops on its next heartbeat and cannot fetch new media once its lease expires.

### Phase 6 — Student and owner operations

**Build:**

- student profile, devices, session management, My Courses, resume playback, completion display, and resource access;
- owner enrollment list, student/device visibility, course archive controls, upload/job visibility, and basic audit views;
- dashboard polling only where a mutation/job state genuinely needs it.

**Done when:** the owner can operate the v1 catalog and support a student without database access, while students have a complete course-consumption flow.

### Phase 7 — Hardening and release readiness

**Build:**

- unit, integration, E2E, security, and load tests;
- PostgreSQL backup, encrypted off-host R2 backup path, retention, restore test, and maintenance jobs;
- health/readiness checks, queue and FFmpeg failure monitoring, structured log retention, and alert runbook;
- production Docker Compose, Nginx routes, TLS/Cloudflare configuration, and secret-management procedure.

**Done when:** a clean environment can be deployed repeatedly; backup restore is proven; critical authorization/IDOR/playback tests pass; and no secret is committed or returned by the API.

## 11. Test gates

### Required automated coverage

- **Unit:** `AuthService`, token rotation, `CourseAccessService`, enrollment transitions, media-lease signer, path mapper, and playback replacement policy.
- **Integration:** Prisma repositories, PostgreSQL constraints, Redis locks/TTL, BullMQ retry handling, R2 adapter, and Worker lease validation.
- **E2E:** register/login → manual enrollment → protected lesson → playback → heartbeat → progress → resume.
- **Security:** IDOR attempts, expired/revoked enrollment, revoked device, token reuse, direct R2 attempt, stale lease, shared manifest URL, owner route requested by student, invalid upload type/size, and concurrent playback.
- **Load:** course browsing, 30-second heartbeats, playback-session creation, owner upload, and at least one FFmpeg job. Video bytes must not traverse the NestJS API in production testing.

### Manual acceptance checks

- Safari/native HLS and Chromium/Firefox with `hls.js` both play the protected stream.
- A browser cannot obtain an original R2 object path, R2 credential, permanent media URL, or long-lived media token.
- A student has no path to grant themselves an enrollment or change a user/lesson/course ID to access another resource.
- A replacement video does not interrupt a lesson until the replacement is ready and activated.

## 12. Environment-variable groups

```text
APP_ENV
APP_URL
API_PORT
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET_OR_PRIVATE_KEY
JWT_ACCESS_TTL
JWT_REFRESH_SECRET
JWT_REFRESH_TTL
MEDIA_LEASE_PRIVATE_KEY
MEDIA_LEASE_PUBLIC_KEY
MEDIA_LEASE_TTL_SECONDS
MAX_REGISTERED_DEVICES
MAX_CONCURRENT_PLAYBACKS
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
FFMPEG_PATH
FFPROBE_PATH
SMTP_*
BACKUP_*
```

`MEDIA_LEASE_PRIVATE_KEY` belongs to the API only. The media Worker receives the corresponding public verification key and its R2 binding; it never receives the API refresh-token secret, playback-signing private key, or a database credential.

## 13. Final v1 acceptance criteria

V1 is ready only when all of the following work together:

1. The seeded owner can create, publish, and archive courses and manage curriculum.
2. A student can authenticate, manage a limited number of devices, and access only active enrollments.
3. The owner can upload a video directly to private R2 and see asynchronous processing complete or fail safely.
4. A student can receive a short-lived playback session, watch adaptive HLS, resume progress, and see a non-sensitive moving watermark.
5. Starting a second stream replaces the old session within the defined heartbeat/lease window.
6. No public R2 media URL, storage credential, source upload, or permanent playback URL is exposed.
7. Owner and student workflows, security cases, backup restore, monitoring, and local clean-start documentation pass their acceptance checks.

After these criteria are met, post-launch features can be evaluated individually without changing the core access, playback, or video-domain boundaries.
