# V1 authorization matrix

NestJS is the final authority. Frontend route guards are UX only. `OWNER` and `STUDENT` are seeded roles; permission checks and resource policies are both mandatory.

| Capability | Public | Student | Owner | Required policy |
| --- | ---: | ---: | ---: | --- |
| Register, login, password reset | Yes | Yes | Yes | Rate limit, origin/CSRF where cookie-authenticated |
| View published catalogue metadata | Yes | Yes | Yes | Published fields only; never asset keys |
| View own profile, sessions, devices | No | Own | Own | Subject ID comes from access token |
| Revoke own device/session | No | Own | Own | Cannot target another user |
| View enrolled courses/curriculum | No | Active enrollment | Yes | `CourseAccessService` verifies complete relationship chain |
| Read protected lesson/resource | No | Active enrollment | Yes | Account + device + enrollment + parent relationship |
| Update own lesson progress | No | Active enrollment | Preview only | Server derives user ID; monotonic maximum position |
| Create/heartbeat/end playback | No | Active enrollment | Preview only | Ready current video, device, concurrency, lease audience |
| Create/update/publish/archive course | No | No | Yes | `course.*` permission and parent checks |
| Manage sections/lessons/order | No | No | Yes | `curriculum.*` permission; atomic ordered-ID list |
| Initiate/complete/retry video work | No | No | Yes | `video.*`; server-generated storage keys |
| Grant/extend/suspend/revoke enrollment | No | No | Yes | `enrollment.*`; idempotency key; audit required |
| View users/enrollments/devices | No | No | Yes | Least-data operations response |
| Read audit/security records | No | No | Yes | `audit.read` / `security.read`; cursor pagination |
| Assign roles or permissions | No | No | Bootstrap/CLI only | No public role-management UI in v1 |

## Permission catalogue

```text
course.create
course.read
course.update
course.publish
course.archive
curriculum.create
curriculum.update
curriculum.reorder
enrollment.create
enrollment.read
enrollment.update
enrollment.revoke
video.upload
video.read
video.retry
video.activate
user.read
user.manage
audit.read
security.read
```

`OWNER` receives all v1 permissions. `STUDENT` receives no owner permission; authenticated student actions are authorized through subject and resource policies.

## Guard and policy order

```text
rate limit
  -> access-token authentication
  -> account status
  -> device/session status
  -> permission check (owner routes)
  -> resource relationship/access policy
  -> use case
```

Every lookup with a client-supplied identifier validates its parent relationship. Knowing a UUID never grants access.
