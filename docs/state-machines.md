# V1 state machines

All transitions are enforced by application use cases and guarded database updates such as `where id = ? and status = ?`. External calls happen outside database transactions. The transaction performs only the state comparison and write.

## Enrollment

```text
              suspend
  ACTIVE ----------------> SUSPENDED
    |  \                       |  \
    |   \ revoke              |   \ revoke
    |    v                     |    v
    |  REVOKED <---------------+  REVOKED
    |
    +---- access window ends ----> EXPIRED

SUSPENDED ---- resume, if inside access window ----> ACTIVE
SUSPENDED ---- access window ends -----------------> EXPIRED
```

- Creation produces `ACTIVE` only when `starts_at <= now` and the access window is valid.
- Future grants are stored as `ACTIVE` with `starts_at` in the future; access checks still deny them until the window starts.
- `REVOKED` is terminal. A later grant updates the same unique enrollment only through an explicit re-grant use case and audit event.
- `EXPIRED` is derived/enforced from `expires_at`; a maintenance job persists it for operations views.
- `completed_at` is learning progress and never changes access status.

## Video upload

```text
PENDING -> UPLOADING -> COMPLETED
   |           |            |
   +---------> ABORTED <-----+
   |           |
   +---------> EXPIRED
   +---------> FAILED
```

- Only the owner may initiate or complete uploads.
- Completion is idempotent and validates provider metadata, expected object key, size, and media type before queueing work.
- `COMPLETED`, `ABORTED`, `EXPIRED`, and `FAILED` are terminal for an upload attempt.

## Video processing

```text
UPLOADING -> UPLOADED -> QUEUED -> PROCESSING -> READY
                             ^          |
                             |          v
                             +------ FAILED

READY -> DELETING -> DELETED
```

- Retrying creates a new processing-job attempt and transitions `FAILED -> QUEUED`.
- A worker claims one queued job using BullMQ identity plus a guarded database transition.
- A video becomes `READY` only after all required assets are uploaded and verified.
- Replacing lesson video is separate: the old current video stays active until the new video is `READY`, then one short transaction atomically switches `is_current`.
- No rendition may exceed source width or height.

## Processing job

```text
QUEUED -> PROCESSING -> COMPLETED
              |
              v
            FAILED -> QUEUED (new retry attempt)
```

- A job record is permanent processing history.
- BullMQ is transport/retry state, not the permanent source of truth.

## Authentication session and refresh token family

```text
SESSION ACTIVE -> REVOKED

TOKEN ISSUED -> USED -> REPLACED
      |          |
      +-------> REVOKED
      +-------> EXPIRED
```

- Refresh consumes the presented token exactly once and creates one child token in the same transaction.
- Presenting a used token is reuse: revoke the entire session/token family, terminate its active playback, and emit a security event.
- Password change, logout-all, account disablement, and device revocation revoke affected sessions.

## Playback session

```text
                    second stream
ACTIVE --------------------------------> REPLACED
  |  \                                      
  |   +---- explicit stop ----------------> ENDED
  |   +---- lease/heartbeat timeout ------> EXPIRED
  |   +---- access/device/session revoked -> REVOKED
```

- All states except `ACTIVE` are terminal.
- Creation locks the user's concurrency key, ends/replaces any active session, creates the new session, and then publishes Redis active state.
- Redis TTL is fast authorization state; PostgreSQL retains the permanent session record.
- Heartbeats never reactivate a terminal session.
- The API signs a 90-second ES256 media lease only while Redis still names the PostgreSQL `ACTIVE` session as the user's current stream.
- `/media/hls/<video-id>/<relative-path>` maps only to `processed/<video-id>/hls/<relative-path>` after strict extension and traversal checks; original sources are unreachable.

## Course

```text
DRAFT -> PUBLISHED -> ARCHIVED
  ^          |
  +----------+  unpublish for correction
```

- Publishing requires at least one section and one valid lesson.
- Archived courses are retained. Existing access behavior is explicit in the use case; archive never hard-deletes curriculum or evidence.
