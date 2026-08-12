# Stable API error catalogue

Every error response uses:

```json
{
  "statusCode": 403,
  "code": "COURSE_ACCESS_DENIED",
  "message": "You do not have access to this course.",
  "details": {},
  "requestId": "0198d03a-81df-7c0f-9908-e700c1c6744d"
}
```

`details` is optional and must never contain secrets, raw provider responses, SQL, stack traces, storage keys, or tokens.

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `VALIDATION_FAILED` | 400 | Request shape or field validation failed |
| `INVALID_CREDENTIALS` | 401 | Login credentials are invalid; do not reveal which field |
| `ACCESS_TOKEN_INVALID` | 401 | Access token is absent, invalid, or expired |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token cannot be used |
| `REFRESH_TOKEN_REUSED` | 401 | Used refresh token was replayed; family revoked |
| `PASSWORD_RESET_TOKEN_INVALID` | 401 | Password-reset token is invalid, expired, or consumed |
| `ACCOUNT_NOT_ACTIVE` | 403 | Account state forbids the operation |
| `DEVICE_LIMIT_REACHED` | 403 | Registered-device limit reached |
| `DEVICE_REVOKED` | 403 | Device is revoked |
| `PERMISSION_DENIED` | 403 | Required owner permission is absent |
| `COURSE_ACCESS_DENIED` | 403 | Student lacks active course access |
| `ENROLLMENT_NOT_STARTED` | 403 | Enrollment access window has not started |
| `ENROLLMENT_EXPIRED` | 403 | Enrollment access window ended |
| `PLAYBACK_REPLACED` | 409 | Another playback replaced this session |
| `PLAYBACK_REVOKED` | 403 | Access/session/device revocation ended playback |
| `VIDEO_NOT_READY` | 409 | Current lesson video is unavailable for playback |
| `INVALID_STATE_TRANSITION` | 409 | Resource is not in a state allowed by the operation |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Key was reused with a different request payload |
| `EMAIL_ALREADY_REGISTERED` | 409 | Registration conflicts with an existing account |
| `RESOURCE_NOT_FOUND` | 404 | Resource is absent or concealed by object authorization |
| `RATE_LIMIT_EXCEEDED` | 429 | Caller exceeded the operation limit |
| `UPLOAD_INVALID` | 422 | Upload metadata/type/size is invalid |
| `PROCESSING_FAILED` | 422 | Media processing failed safely |
| `DEPENDENCY_UNAVAILABLE` | 503 | Required infrastructure is unavailable |
| `INTERNAL_SERVER_ERROR` | 500 | Masked unexpected server failure |

Messages may improve without changing client behavior. Clients branch on `code`, never on human-readable text.
