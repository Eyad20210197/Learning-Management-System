# LMS Backend Implementation Plan

> **Status — superseded implementation details:** The canonical v1 plan is [LMS_V1_JavaScript_Implementation_Plan.md](LMS_V1_JavaScript_Implementation_Plan.md). This document remains useful background, but the canonical plan overrides it wherever they differ. In particular, v1 uses **TypeScript**, **HLS-only playback**, a **private R2 + Cloudflare Worker media gateway**, and a **React/Vite SPA**. The system has one `OWNER` and `STUDENT` users only.

## 1. System Goal

Build a production-ready LMS backend with:

- Authentication and authorization
- Role/permission management
- Course management
- Sections and lessons
- Student enrollments
- Video upload and processing
- Cloudflare R2 private storage
- HLS-only delivery
- Short-lived signed playback access
- Device/session controls
- One active playback session per user
- Dynamic watermark metadata
- Progress tracking
- Redis for temporary state, rate limiting, queues, and locks
- PostgreSQL as the permanent source of truth
- Audit logging
- Background workers
- Backups, monitoring, and localhost development readiness

The system should start as a **modular monolith**, not microservices.

---

# 2. Recommended Stack

## Backend

- Node.js 20+
- NestJS in pure JavaScript (`nest new --language TS`)
- ESM modules with ESLint and Prettier; no TypeScript source files in v1

## Database

- PostgreSQL
- Prisma ORM

## Temporary State / Queue

- Redis
- BullMQ

## Object Storage

- Cloudflare R2
- Private buckets only

## Video Processing

- FFmpeg
- FFprobe

## Delivery

- HLS with native browser support where available and `hls.js` elsewhere
- H.264/AAC outputs only; do not deliver MP4 assets to students in v1
- A same-origin `/media/*` Cloudflare Worker validates a short-lived playback lease for every HLS object and streams it from private R2

## Reverse Proxy

- Not required for localhost development
- Nginx is deferred until VPS/production deployment

## Deployment

### Current Development

- Localhost
- Docker / Docker Compose optional but recommended for PostgreSQL and Redis
- Backend runs locally
- Worker runs locally
- PostgreSQL runs locally
- Redis runs locally
- FFmpeg runs locally
- Cloudflare R2 can still be used remotely for storage testing

### Later Production

- VPS
- Docker
- Docker Compose
- Nginx
- TLS / Cloudflare

## Security

- Argon2id
- JWT access tokens
- Rotating refresh tokens
- RBAC + permissions
- Rate limiting
- Audit logging
- Device limits
- Concurrent playback controls

---

# 3. High-Level Architecture

## Current Localhost Architecture

```text
                    Local Machine
                         |
          +--------------+--------------+
          |                             |
          v                             v
      Frontend                      NestJS API
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
                    v                   v                   v
               PostgreSQL             Redis              BullMQ
                                                            |
                                                            v
                                                         Worker
                                                            |
                                                            v
                                                         FFmpeg
                                                            |
                                                            v
                                                    Cloudflare R2
                                                      Private
```

## Later Production Architecture

```text
                         Cloudflare
                    DNS / Proxy / TLS
                           |
                           v
                        Nginx
                           |
               +-----------+-----------+
               |                       |
               v                       v
           Frontend                 NestJS API
                                       |
                   +-------------------+-------------------+
                   |                   |                   |
                   v                   v                   v
              PostgreSQL             Redis              BullMQ
                                                           |
                                                           v
                                                        Worker
                                                           |
                                                           v
                                                        FFmpeg
                                                           |
                                                           v
                                                   Cloudflare R2
                                                     Private
```

---

# 4. Backend Architectural Style

Use a **modular monolith**.

Each domain should own:

- Controller
- Service
- Repository/data access
- DTOs
- Entities/models
- Guards/policies when needed
- Domain validation
- Tests

Suggested structure:

```text
src/
├── auth/
├── users/
├── roles/
├── permissions/
├── students/
├── courses/
├── sections/
├── lessons/
├── enrollments/
├── progress/
├── uploads/
├── videos/
├── transcoding/
├── storage/
├── playback/
├── devices/
├── sessions/
├── notifications/
├── audit/
├── admin/
├── security/
├── health/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   ├── constants/
│   ├── enums/
│   ├── utils/
│   └── types/
└── config/
```

---

# 5. Domain Separation

## LMS Domain

```text
Users
Roles
Permissions
Courses
Sections
Lessons
Enrollments
Progress
```

## Video Domain

```text
Uploads
Video Assets
Variants
Processing Jobs
Storage
Playback
Playback Sessions
Devices
Security
```

Keep the video delivery implementation abstracted so R2/HLS can later be replaced without changing course logic.

---

# 6. Database Entities

## 6.1 users

```text
id
email
password_hash
first_name
last_name
status
email_verified_at
created_at
updated_at
last_login_at
```

Suggested status:

```text
ACTIVE
SUSPENDED
DISABLED
PENDING_VERIFICATION
```

---

## 6.2 roles

```text
id
name
description
created_at
updated_at
```

Initial roles:

```text
OWNER
STUDENT
```

Optional later:

```text
SUPPORT
```

This is a one-man LMS. There is no instructor role. The owner/admin is the only person who creates and manages course content.

---

## 6.3 permissions

```text
id
key
description
created_at
```

Example keys:

```text
course.create
course.read
course.update
course.delete
course.publish

section.create
section.update
section.delete

lesson.create
lesson.update
lesson.delete

video.upload
video.delete
video.read

user.read
user.manage

enrollment.create
enrollment.read
enrollment.revoke

analytics.read

audit.read
```

---

## 6.4 user_roles

```text
user_id
role_id
created_at
```

Composite unique:

```text
(user_id, role_id)
```

---

## 6.5 role_permissions

```text
role_id
permission_id
created_at
```

Composite unique:

```text
(role_id, permission_id)
```

---

## 6.6 refresh_tokens

```text
id
user_id
token_hash
device_id
expires_at
revoked_at
created_at
replaced_by_token_id
```

Never store plaintext refresh tokens.

---

## 6.7 devices

```text
id
user_id
device_uuid
device_name
browser
os
user_agent
first_seen_at
last_seen_at
trusted
revoked_at
created_at
updated_at
```

Recommended rule:

```text
maximum registered devices = 2 or 3
```

Do not use IP as the primary device identifier.

---

## 6.8 login_sessions

```text
id
user_id
device_id
ip_address
user_agent
created_at
last_seen_at
revoked_at
```

---

## 6.9 courses

```text
id
title
slug
description
thumbnail_key
status
visibility
published_at
created_at
updated_at
```

Because this is a one-man LMS, courses do not require an instructor/owner foreign key in v1.

Status:

```text
DRAFT
REVIEW
PUBLISHED
ARCHIVED
```

Visibility:

```text
PUBLIC
PRIVATE
UNLISTED
```

---

## 6.10 course_sections

```text
id
course_id
title
description
sort_order
created_at
updated_at
```

---

## 6.11 lessons

```text
id
section_id
title
description
type
sort_order
is_preview
status
created_at
updated_at
```

Possible type values:

```text
VIDEO
TEXT
PDF
QUIZ
ASSIGNMENT
LIVE
```

Initial v1 can implement only the required types.

---

## 6.12 lesson_resources

```text
id
lesson_id
title
storage_key
mime_type
size_bytes
created_at
```

---

## 6.13 enrollments

```text
id
user_id
course_id
status
starts_at
expires_at
completed_at
created_at
updated_at
```

Status:

```text
PENDING
ACTIVE
EXPIRED
SUSPENDED
REVOKED
COMPLETED
```

Unique:

```text
(user_id, course_id)
```

---

## 6.14 course_access_rules

```text
id
course_id
access_type
duration_days
created_at
updated_at
```

Access type:

```text
PERMANENT
FIXED_DURATION
CUSTOM_EXPIRY
```

---

## 6.15 videos

```text
id
lesson_id
status
duration_seconds
source_filename
source_size_bytes
source_resolution
source_codec
created_at
updated_at
```

Status:

```text
UPLOADING
UPLOADED
QUEUED
PROCESSING
READY
FAILED
DELETING
DELETED
```

---

## 6.16 video_assets

```text
id
video_id
storage_provider
storage_key
delivery_type
mime_type
size_bytes
created_at
```

Delivery type:

```text
MP4
HLS
```

---

## 6.17 video_variants

Used if multiple qualities exist.

```text
id
video_id
resolution
bitrate
codec
playlist_key
size_bytes
status
created_at
updated_at
```

Examples:

```text
360p
480p
720p
1080p
```

Do not upscale beyond source resolution.

---

## 6.18 video_processing_jobs

```text
id
video_id
status
job_type
attempt
started_at
finished_at
error_message
created_at
updated_at
```

Status:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
```

---

## 6.19 video_uploads

```text
id
video_id
user_id
upload_type
storage_key
status
upload_id
size_bytes
created_at
completed_at
expires_at
```

Useful for multipart uploads.

---

## 6.20 playback_sessions

Permanent audit copy in PostgreSQL.

```text
id
user_id
lesson_id
video_id
device_id
status
started_at
last_heartbeat_at
ended_at
last_position_seconds
ip_address
session_code
created_at
updated_at
```

Redis should hold the fast active-state representation.

Status:

```text
ACTIVE
ENDED
EXPIRED
REVOKED
REPLACED
```

---

## 6.21 playback_events

```text
id
playback_session_id
event_type
position_seconds
metadata
created_at
```

Possible events:

```text
START
PAUSE
RESUME
SEEK
HEARTBEAT
COMPLETE
BLOCKED
END
```

Do not log excessive noise unless analytics require it.

---

## 6.22 lesson_progress

```text
id
user_id
lesson_id
watched_seconds
last_position_seconds
percentage
completed_at
created_at
updated_at
```

Unique:

```text
(user_id, lesson_id)
```

---

## 6.23 audit_logs

```text
id
actor_id
action
target_type
target_id
metadata
ip_address
user_agent
created_at
```

Examples:

```text
USER_LOGIN
LOGIN_FAILED
PASSWORD_CHANGED
DEVICE_ADDED
DEVICE_REMOVED
COURSE_CREATED
COURSE_PUBLISHED
VIDEO_UPLOADED
VIDEO_DELETED
ENROLLMENT_CREATED
ENROLLMENT_REVOKED
PLAYBACK_BLOCKED
ADMIN_ACTION
```

Never store passwords, access tokens, refresh tokens, R2 secrets, or private keys in audit logs.

---

## 6.24 security_events

```text
id
user_id
device_id
type
severity
metadata
created_at
resolved_at
```

Possible types:

```text
TOO_MANY_LOGIN_ATTEMPTS
DEVICE_LIMIT_EXCEEDED
CONCURRENT_PLAYBACK
TOKEN_REUSE
SUSPICIOUS_PLAYBACK
ACCESS_DENIED
```

---

# 7. Authentication Implementation

## 7.1 Register

```http
POST /auth/register
```

Flow:

```text
validate request
→ check duplicate email
→ hash password with Argon2id
→ create user
→ assign STUDENT role
→ generate verification token if email verification is enabled
→ return safe user object
```

---

## 7.2 Login

```http
POST /auth/login
```

Flow:

```text
validate credentials
→ check account status
→ verify Argon2 hash
→ resolve/create device
→ enforce device rules
→ create login session
→ issue access token
→ issue refresh token
→ store refresh token hash
→ write audit event
```

Recommended:

```text
Access token: 10–15 minutes
Refresh token: longer-lived
```

---

## 7.3 Refresh

```http
POST /auth/refresh
```

Use refresh-token rotation.

Flow:

```text
receive refresh token
→ find hash
→ validate expiry/revocation/device
→ revoke old token
→ issue new access token
→ issue new refresh token
→ store replacement hash
```

Detect refresh token reuse.

---

## 7.4 Logout

```http
POST /auth/logout
```

Revoke:

```text
refresh token
login session
optional playback session
```

---

## 7.5 Logout All Devices

```http
POST /auth/logout-all
```

Revoke:

```text
all refresh tokens
all login sessions
all active playback sessions
```

---

## 7.6 Password Operations

```http
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
```

Password reset tokens must be:

```text
random
single-use
short-lived
stored hashed
```

---

# 8. Authorization / RBAC

Do not authorize only by role name.

Use permissions.

Example:

```text
Role
  ↓
Permissions
  ↓
Guard
  ↓
Endpoint
```

NestJS example concept:

```text
@RequirePermissions('course.create')
```

Global flow:

```text
JWT Guard
→ User Status Guard
→ Permission Guard
→ Resource Ownership Policy
```

Resource-level authorization remains mandatory.

For v1, only the OWNER role can create, update, publish, archive, or delete course content.

---

# 9. Course APIs

## Courses

```http
POST   /courses
GET    /courses
GET    /courses/:courseId
PATCH  /courses/:courseId
DELETE /courses/:courseId
POST   /courses/:courseId/publish
POST   /courses/:courseId/archive
```

---

# 10. Section APIs

```http
POST   /courses/:courseId/sections
GET    /courses/:courseId/sections
PATCH  /sections/:sectionId
DELETE /sections/:sectionId
POST   /courses/:courseId/sections/reorder
```

Ordering uses:

```text
sort_order
```

Never rely on IDs for curriculum order.

---

# 11. Lesson APIs

```http
POST   /sections/:sectionId/lessons
GET    /lessons/:lessonId
PATCH  /lessons/:lessonId
DELETE /lessons/:lessonId
POST   /sections/:sectionId/lessons/reorder
```

Every lesson operation must validate admin permissions.

---

# 12. Enrollment APIs

```http
POST   /courses/:courseId/enrollments
GET    /courses/:courseId/enrollments
GET    /me/enrollments
PATCH  /enrollments/:enrollmentId
POST   /enrollments/:enrollmentId/revoke
```

Access must depend on enrollment state, not payment rows directly.

Correct:

```text
Payment
  ↓
Enrollment Service
  ↓
ACTIVE Enrollment
```

This allows:

```text
manual grants
free courses
promo access
scholarships
corporate access
future subscriptions
```

---

# 13. Course Access Service

Create a central service:

```text
CourseAccessService
```

Responsibilities:

```text
user account active?
course published?
enrollment exists?
enrollment active?
starts_at passed?
expires_at not passed?
lesson belongs to course?
lesson allowed?
preview allowed?
```

All protected lesson/video access must go through this service.

---

# 14. R2 Storage Implementation

Use a private Cloudflare R2 bucket.

Suggested logical structure:

```text
lms-private/
├── courses/
│   └── course_<id>/
│       └── videos/
│           └── video_<id>/
│               ├── source/
│               ├── hls/
│               └── mp4/
├── resources/
├── thumbnails/
├── temp/
└── backups/
```

Never expose bucket credentials to the browser.

---

# 15. Upload Architecture

Avoid routing large video bytes through NestJS.

Preferred flow:

```text
Owner/Admin
   |
   | 1. request upload authorization
   v
Backend
   |
   | 2. validate permission
   | 3. create upload record
   | 4. create temporary signed upload
   v
Browser
   |
   | 5. upload directly
   v
R2
   |
   | 6. client/backend marks completion
   v
Backend
```

---

# 16. Upload APIs

```http
POST /videos/uploads
POST /videos/uploads/:uploadId/complete
POST /videos/uploads/:uploadId/abort
GET  /videos/uploads/:uploadId
```

For large files, support multipart upload.

---

# 17. Video Processing Queue

Use Redis + BullMQ.

Never process FFmpeg inside the HTTP request.

Flow:

```text
upload completed
→ create database processing record
→ enqueue BullMQ job
→ worker receives job
→ download/open source
→ FFprobe
→ FFmpeg
→ upload results to R2
→ verify
→ update database
→ cleanup local temp files
```

---

# 18. Video Processing Worker

Separate worker process/container.

Responsibilities:

```text
validate source
run ffprobe
detect resolution
detect duration
detect codecs
select output variants
run FFmpeg
generate HLS or normalized MP4
upload results
verify output
set video READY
cleanup local files
```

Do not let API container perform expensive FFmpeg work.

---

# 19. Video Processing State Machine

```text
UPLOADING
    |
    v
UPLOADED
    |
    v
QUEUED
    |
    v
PROCESSING
   / \
  v   v
READY FAILED
```

Optional:

```text
READY
  |
  v
DELETING
  |
  v
DELETED
```

Store:

```text
processing_started_at
processing_finished_at
processing_error
retry_count
```

---

# 20. HLS Pipeline

If HLS is enabled:

```text
source video
   |
   v
FFprobe
   |
   v
choose renditions
   |
   v
FFmpeg
   |
   +--> 1080p
   +--> 720p
   +--> 480p
   +--> 360p
   |
   v
master.m3u8
   |
   v
upload to R2
```

Do not upscale.

Example:

```text
Source 720p
→ generate 720p
→ generate 480p
→ generate 360p
→ do not generate 1080p
```

HLS itself has no license cost.

Encoding happens once per video unless reprocessing is required.

---

# 21. MP4 Pipeline

If MP4 is used instead:

```text
source video
→ optional normalization with FFmpeg
→ H.264/AAC
→ upload final MP4
→ serve using signed access
```

Optional variants:

```text
1080p.mp4
720p.mp4
480p.mp4
```

HTTP Range requests must be supported for usable seeking.

---

# 22. Delivery Abstraction

Create:

```text
PlaybackProvider
```

Possible implementations:

```text
R2Mp4PlaybackProvider
R2HlsPlaybackProvider
FutureDrmProvider
FutureCloudflareStreamProvider
```

The rest of the LMS should not care how the video is delivered.

---

# 23. Secure Playback API

```http
POST /lessons/:lessonId/playback
```

Required backend checks:

```text
authenticated?
→ account active?
→ device valid?
→ device limit satisfied?
→ course exists?
→ lesson belongs to course?
→ enrollment active?
→ course access valid?
→ video READY?
→ concurrent playback rule satisfied?
```

Then:

```text
create playback session
→ store fast active session in Redis
→ persist session in PostgreSQL
→ generate short-lived playback access
→ generate watermark metadata
→ return playback response
```

---

# 24. Playback Response

Example:

```json
{
  "sessionId": "ps_123",
  "deliveryType": "HLS",
  "playbackUrl": "https://...",
  "expiresAt": "2026-08-11T...",
  "watermark": {
    "text": "EY*** • 49382 • 8K29"
  }
}
```

Never expose permanent public storage URLs.

---

# 25. Signed Playback Access

Signed access should be short-lived.

Recommended:

```text
5–15 minutes
```

Purpose:

```text
prevent permanent URL sharing
```

It is not DRM.

An authorized technical user can still capture content.

---

# 26. Redis Playback State

Suggested keys:

```text
playback:user:<userId>
playback:session:<sessionId>
playback:device:<deviceId>
```

Example value:

```json
{
  "sessionId": "ps_123",
  "userId": 42,
  "videoId": 99,
  "deviceId": "dev_abc",
  "lastHeartbeat": 1723370000
}
```

Set TTL so dead sessions expire automatically.

---

# 27. Playback Heartbeats

Endpoint:

```http
POST /playback/:sessionId/heartbeat
```

Frequency:

```text
approximately every 30–60 seconds
```

Payload:

```json
{
  "position": 845,
  "playing": true
}
```

Backend:

```text
verify session
→ verify current user
→ verify device
→ update Redis TTL
→ update last position
→ periodically persist progress
```

Do not write PostgreSQL every second.

---

# 28. Concurrent Playback Rule

Recommended initial policy:

```text
registered devices: 2–3
concurrent streams: 1
```

When new playback starts and another active playback exists:

Recommended behavior:

```text
terminate old session
allow newest session
```

Old session becomes:

```text
REPLACED
```

The old player should fail its next heartbeat/request.

---

# 29. Device Identification

Use a local persistent identifier generated by the application.

Example:

```text
random UUID
stored locally
sent with authentication/session requests
```

Combine with:

```text
browser
OS
user agent
```

Do not claim this is unforgeable.

Do not rely primarily on:

```text
IP address
MAC address
```

A normal browser cannot securely expose the device MAC address.

---

# 30. Device APIs

```http
GET    /me/devices
DELETE /me/devices/:deviceId
POST   /me/devices/:deviceId/revoke
```

Admin:

```http
GET  /admin/users/:userId/devices
POST /admin/users/:userId/devices/:deviceId/revoke
```

---

# 31. Dynamic Watermark

Backend generates watermark payload associated with the playback session.

Example:

```text
EY*** • 49382 • 8K29
```

Use:

```text
masked user identifier
internal user id or code
session code
```

Do not expose unnecessary private information.

Frontend moves watermark periodically.

Example:

```text
top-left
center
bottom-right
top-right
```

The backend should map `session_code` to:

```text
user
device
lesson
video
playback session
timestamp
```

---

# 32. Progress Tracking

Endpoint examples:

```http
GET  /lessons/:lessonId/progress
POST /lessons/:lessonId/progress
```

Recommended stored fields:

```text
watched_seconds
last_position_seconds
percentage
completed_at
```

Possible completion rule:

```text
watched >= 90%
```

Make threshold configurable if needed.

---

# 33. Redis Responsibilities

Use Redis for:

```text
active playback sessions
concurrent playback locks
rate limiting
BullMQ jobs
temporary security state
short-lived caches
temporary idempotency keys
```

Do not use Redis as the permanent source of truth.

---

# 34. PostgreSQL Responsibilities

Use PostgreSQL for:

```text
users
courses
lessons
roles
permissions
enrollments
progress
devices
video metadata
processing history
audit logs
security events
permanent playback history
```

---

# 35. Rate Limiting

Apply rate limits to:

```text
/auth/login
/auth/refresh
/auth/forgot-password
/auth/reset-password
/videos/uploads
/lessons/:id/playback
/playback/:id/heartbeat
```

Examples:

```text
Login:
5–10 attempts per minute per IP/user context

Password reset:
strict limit

Playback creation:
per-user and per-device limit

Upload:
per-admin limit
```

Store counters in Redis.

---

# 36. Audit Logging

Create centralized:

```text
AuditService
```

Every important action should call it.

Record:

```text
actor
action
target
time
IP
user agent
safe metadata
```

Do not log secrets.

---

# 37. Security Rules

Mandatory:

```text
HTTPS only
Argon2id passwords
short-lived access tokens
rotating refresh tokens
HttpOnly secure refresh cookies where appropriate
CORS allowlist
Helmet
input validation
DTO validation
parameter validation
authorization on every protected resource
private R2
rate limiting
upload validation
file size limits
MIME validation
audit logs
secret management
backup strategy
```

---

# 38. IDOR Protection

Never assume knowing an ID grants access.

Example:

```http
GET /lessons/123
```

Must verify:

```text
user allowed to access lesson?
```

Example:

```http
POST /lessons/123/playback
```

Must verify:

```text
lesson belongs to enrolled course?
```

Every object-level access path needs authorization.

---

# 39. Upload Security

Validate:

```text
allowed MIME types
allowed file extensions
maximum file size
actual media metadata
course ownership
video ownership
storage key generation
```

Never trust client-supplied object keys directly.

Generate storage paths server-side.

---

# 40. Background Jobs

Use BullMQ for:

```text
video transcoding
thumbnail generation
video cleanup
email sending
session cleanup
orphaned upload cleanup
backup triggers if appropriate
```

---

# 41. Scheduled Maintenance Jobs

Examples:

```text
Every 5 minutes:
expire stale playback sessions

Daily:
expire enrollments
remove abandoned uploads
remove expired refresh tokens

Daily:
database backup

Weekly:
storage consistency/orphan check
```

---

# 42. Backup Strategy

PostgreSQL:

```text
pg_dump
   |
   v
encrypted backup
   |
   v
R2 backup bucket/path
```

Retention example:

```text
daily × 7
weekly × 4
monthly × 6
```

Backup storage should be isolated logically from public/course assets.

---

# 43. Health Checks

Endpoint:

```http
GET /health
```

Return status for:

```text
API
PostgreSQL
Redis
R2 connectivity if useful
queue state
```

Example:

```json
{
  "api": "ok",
  "database": "ok",
  "redis": "ok"
}
```

---

# 44. Monitoring

Monitor:

```text
CPU
RAM
disk
load average
API latency
5xx errors
PostgreSQL connections
Redis memory
queue length
failed jobs
FFmpeg failures
R2 failures
active playback sessions
```

FFmpeg is likely the largest temporary CPU consumer.

---

# 45. Localhost Development Deployment

Current development runs locally.

Recommended local services:

```text
frontend
api
worker
postgres
redis
FFmpeg
```

You can run PostgreSQL and Redis through Docker Compose while running the NestJS API and worker directly from Node.js, or containerize everything if preferred.

Local concept:

```text
localhost
  |
  +--> frontend
  |
  +--> api
         +--> local PostgreSQL
         +--> local Redis
         +--> R2

worker
  +--> local Redis
  +--> R2
  +--> local FFmpeg
```

Nginx is not required during local development.

When the VPS is rented later, add:

```text
Nginx
Docker Compose production configuration
TLS
Cloudflare DNS/proxy
production environment secrets
```

---

# 46. Local Development Directory

Example:

```text
lms/
├── backend/
├── frontend/
├── docker-compose.yml
├── .env
├── backups/
└── temp/
```

Do not permanently store course videos on the development machine except as temporary upload/processing files.

Temporary FFmpeg flow:

```text
download/open source
→ /tmp/video-job-123
→ process
→ upload to R2
→ verify
→ delete local temp files
```

---

# 47. Environment Variables

Example groups:

```text
APP_ENV
APP_PORT
APP_URL

DATABASE_URL

REDIS_URL

JWT_ACCESS_SECRET
JWT_ACCESS_TTL
JWT_REFRESH_SECRET
JWT_REFRESH_TTL

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT

PLAYBACK_URL_TTL
MAX_REGISTERED_DEVICES
MAX_CONCURRENT_PLAYBACKS

FFMPEG_PATH
FFPROBE_PATH

SMTP_*
```

Never commit `.env`.

---

# 48. API Error Format

Use a consistent error schema.

Example:

```json
{
  "statusCode": 403,
  "code": "COURSE_ACCESS_DENIED",
  "message": "You do not have access to this course."
}
```

Suggested fields:

```text
statusCode
code
message
details
requestId
```

---

# 49. API Versioning

Use:

```text
/api/v1
```

Example:

```http
POST /api/v1/auth/login
GET  /api/v1/courses
POST /api/v1/lessons/:id/playback
```

---

# 50. Pagination

Use consistent pagination.

For admin tables:

```text
page
limit
sort
filters
```

For very large event/audit tables, cursor pagination can be introduced later.

---

# 51. Logging

Application logs should include:

```text
timestamp
level
requestId
route
statusCode
duration
userId when available
safe error context
```

Never log:

```text
password
refresh token
JWT
R2 secret
signed URL query parameters if sensitive
```

---

# 52. Testing Strategy

## Unit Tests

Prioritize:

```text
AuthService
CourseAccessService
EnrollmentService
PlaybackService
DeviceService
VideoProcessingService
```

---

## Integration Tests

Test:

```text
PostgreSQL repository behavior
Redis playback state
BullMQ jobs
R2 adapter
token rotation
```

---

## E2E Tests

Happy path:

```text
student registers
→ logs in
→ gets enrollment
→ opens lesson
→ playback authorized
→ heartbeat
→ progress saved
```

Unauthorized:

```text
student logs in
→ requests unpurchased course
→ denied
→ no playback URL returned
```

---

# 53. Security Test Cases

Explicitly test:

```text
student requests another student's resource
student modifies course ID
student modifies lesson ID
expired enrollment
revoked enrollment
revoked account
revoked device
expired signed playback URL
two simultaneous streams
shared playback URL
refresh token reuse
student calls admin endpoint
owner/admin edits another owner/admin's course
invalid upload MIME
oversized upload
tampered device ID
stale playback heartbeat
```

---

# 54. Performance Tests

Example load scenario:

```text
100 authenticated users
50 browsing
30 starting playback
30 sending heartbeats
10 updating progress
1 owner uploading
1–2 FFmpeg jobs
```

During development, the local machine should mainly carry:

```text
API
authorization
database
Redis
FFmpeg processing
```

R2 should carry video delivery bytes.

---

# 55. Admin Backend Features

Endpoints/support for:

```text
users
roles
permissions
courses
enrollments
videos
processing jobs
storage metadata
active sessions
devices
security events
audit logs
```

Dashboard metrics may include:

```text
students
active enrollments
courses
video hours
storage usage
active streams
failed jobs
```

---

# 56. Owner/Admin Backend Features

Support:

```text
create course
edit any course
manage curriculum
upload video
view processing status
manage resources
preview course
publish course
view enrolled students
basic analytics
```

There is only one content manager in v1: the system owner/admin.

---

# 57. Student Backend Features

Support:

```text
dashboard
my courses
course details
lesson access
secure playback
progress
profile
devices
sessions
notifications
```

---

# 58. API Groups

## Auth

```text
/auth/*
```

## Users

```text
/users/*
/me/*
```

## Roles/Permissions

```text
/roles/*
/permissions/*
```

## Courses

```text
/courses/*
```

## Sections

```text
/sections/*
```

## Lessons

```text
/lessons/*
```

## Enrollments

```text
/enrollments/*
```

## Videos

```text
/videos/*
```

## Playback

```text
/playback/*
```

## Devices

```text
/devices/*
```

## Progress

```text
/progress/*
```

## Admin

```text
/admin/*
```

## Audit

```text
/audit/*
```

## Health

```text
/health
```

---

# 59. Implementation Milestones

## M1 — Foundation

Deliver:

```text
NestJS project
configuration
Docker
PostgreSQL
Prisma
Redis
global validation
logging
error handling
health endpoint
```

---

## M2 — Identity & Security

Deliver:

```text
users
roles
permissions
RBAC
registration
login
refresh rotation
logout
password reset
devices
sessions
rate limiting
audit base
```

---

## M3 — LMS Core

Deliver:

```text
courses
sections
lessons
ordering
enrollments
course access service
student course access
```

---

## M4 — Storage & Upload

Deliver:

```text
R2 adapter
private bucket
signed upload flow
multipart upload if needed
video records
upload state
```

---

## M5 — Video Processing

Deliver:

```text
BullMQ
worker
FFprobe
FFmpeg
processing state machine
HLS and/or MP4 output
R2 upload
retry logic
cleanup
```

---

## M6 — Secure Playback

Deliver:

```text
playback service
signed access
Redis active session
heartbeat
device rules
single concurrent playback
watermark payload
playback audit
```

---

## M7 — Progress & Student Experience Backend

Deliver:

```text
lesson progress
resume position
completion rules
my courses
course curriculum response
```

---

## M8 — Admin / Owner/Admin Backend

Deliver:

```text
admin user management
course management
enrollment management
video job management
device/session management
audit/security views
OWNER-only course-management rules
```

---

## M9 — Hardening

Deliver:

```text
security tests
IDOR tests
upload validation
rate limits
logging
monitoring
backup jobs
failure recovery
```

---

## M10 — Local Release Readiness

Deliver:

```text
local Docker Compose where useful
local environment configuration
database migrations
Redis configuration
backups
monitoring/logging
repeatable local startup procedure
```

Production/VPS deployment is deferred until a VPS is rented.

---

# 60. Exact Implementation Order

```text
01. Initialize NestJS project
02. Add TypeScript strict configuration
03. Add configuration module
04. Add Docker development environment
05. Add PostgreSQL
06. Add Prisma
07. Add Redis
08. Add global validation
09. Add global exception handling
10. Add request logging/request IDs
11. Implement health endpoint

12. Implement users
13. Implement roles
14. Implement permissions
15. Seed initial roles/permissions
16. Implement JWT access tokens
17. Implement Argon2id passwords
18. Implement refresh-token rotation
19. Implement login sessions
20. Implement device registry
21. Implement logout/logout-all
22. Implement password reset
23. Implement rate limiting
24. Implement audit service

25. Implement courses
26. Implement sections
27. Implement lessons
28. Implement curriculum ordering
29. Implement OWNER-only course management policy
30. Implement enrollment model
31. Implement enrollment service
32. Implement course access service

33. Implement R2 storage adapter
34. Configure private bucket
35. Implement upload authorization
36. Implement direct upload
37. Implement multipart upload if required
38. Implement video records
39. Implement upload completion

40. Add BullMQ
41. Create worker application/process
42. Install FFmpeg/FFprobe
43. Implement media inspection
44. Implement processing state machine
45. Implement MP4 normalization if used
46. Implement HLS output if used
47. Implement variant selection
48. Upload processed assets to R2
49. Verify processed assets
50. Delete temporary files
51. Implement processing retry/failure handling

52. Implement playback provider abstraction
53. Implement R2 playback provider
54. Implement lesson playback endpoint
55. Implement short-lived signed playback access
56. Implement playback_sessions table
57. Implement Redis active playback state
58. Implement heartbeat endpoint
59. Implement stale-session TTL
60. Implement one-concurrent-stream rule
61. Implement device-limit enforcement
62. Implement watermark session code

63. Implement lesson progress
64. Implement resume playback
65. Implement completion logic
66. Implement student My Courses APIs

67. Implement admin user APIs
68. Implement admin enrollment APIs
69. Implement admin video/job APIs
70. Implement admin device/session APIs
71. Implement audit/security APIs

72. Add background cleanup jobs
73. Add enrollment expiration job
74. Add abandoned-upload cleanup
75. Add refresh-token cleanup
76. Add database backups
77. Add R2 backup storage
78. Add monitoring
79. Add security test suite
80. Add load tests
81. Finalize local Docker/dev environment
82. Verify local startup from clean state
83. Verify local migrations
84. Verify local backup/restore
85. Prepare production deployment notes for later VPS setup
```

---

# 61. MVP Boundary

The backend is v1-ready when these are complete:

```text
Authentication
RBAC
Users
Courses
Sections
Lessons
Enrollments
Course Access
Private R2
Video Upload
FFmpeg Processing
HLS or MP4 Delivery
Signed Playback Access
Device Limits
One Concurrent Playback
Playback Heartbeat
Watermark Metadata
Progress Tracking
Admin APIs
Owner/Admin APIs
Student APIs
Audit Logs
Rate Limiting
Backups
Monitoring
Deployment
```

---

# 62. Explicitly Deferred Features

Do not include in the first backend unless business requirements require them:

```text
DRM
Widevine
FairPlay
PlayReady
commercial forensic watermarking
anti-piracy SaaS
advanced browser fingerprinting
enterprise WAF
multi-CDN
enterprise SIEM
geo-risk scoring
GPU transcoding farm
microservices
quizzes
assignments
certificates
forums
chat
gamification
affiliate system
marketplace
advanced analytics
mobile-specific backend
AI tutor
live classrooms
```

---

# 63. Security Position

The v1 goal is:

```text
prevent casual downloading
prevent permanent public video links
prevent account sharing
limit concurrent watching
identify leaked recordings
protect course authorization
```

The system does **not** claim that an authorized user cannot capture the video.

Without DRM, a sufficiently technical authorized user can still capture content.

The practical security stack is:

```text
Private R2
+
Authentication
+
Enrollment Authorization
+
Short-Lived Signed Playback Access
+
Device Limits
+
One Concurrent Playback
+
Dynamic Watermark
+
Rate Limiting
+
Audit Logs
+
HTTPS
```

---

# 64. Final Backend Target

## Current Localhost Target

```text
Local Machine
   |
   v
NestJS API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL             Redis
                         |
                         +--> playback state
                         +--> rate limits
                         +--> BullMQ
                                  |
                                  v
                               Worker
                                  |
                                  v
                               FFmpeg
                                  |
                                  v
                             Private R2
                                  |
                                  v
                              Students/Test Clients
```

## Later Production Target

```text
Cloudflare
   |
   v
Nginx
   |
   v
NestJS API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL             Redis
                         |
                         +--> playback state
                         +--> rate limits
                         +--> BullMQ
                                  |
                                  v
                               Worker
                                  |
                                  v
                               FFmpeg
                                  |
                                  v
                             Private R2
                                  |
                                  v
                              Students
```

Backend responsibilities:

```text
identity
authorization
enrollments
course access
device rules
playback sessions
signed access
progress
audit
processing orchestration
```

R2 responsibilities:

```text
store course video assets
store resources
deliver authorized video bytes
store backups
```

Redis responsibilities:

```text
temporary active state
playback concurrency
rate limits
queues
locks
short-lived cache
```

PostgreSQL responsibilities:

```text
permanent business data
permanent security/audit data
course/enrollment truth
video metadata
progress
```

This is the implementation plan for the backend v1.
