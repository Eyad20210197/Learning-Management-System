# LMS Frontend Implementation Plan

## Scope

This plan covers the React TypeScript SPA in:

`C:\Users\Eyad Aboelftoh\Documents\LMS\frontend`

The frontend is a thin, accessible product interface. NestJS remains the authority for authentication, authorization, validation, enrollment, playback, and all business rules. The UI must never treat route guards or hidden controls as security boundaries.

The public entry point is a minimalist landing page at `/`. Its primary purpose is orientation and a direct path to `/login`; it is not a separate marketing product.

The product has two experiences:

- **Student:** discover enrolled learning, continue one lesson, watch protected HLS, and manage personal account access.
- **Owner:** manage courses and curriculum, grant enrollment, upload/process videos, and inspect operational state.

There is no frontend for payments, instructors, role administration, quizzes, forums, chat, or other deferred V1 features.

## UX direction: quiet by default

The interface should be understandable without a tour or documentation. Every screen follows these rules:

1. One obvious primary action. Secondary actions live in contextual menus or inline links.
2. Progressive disclosure: show the next useful decision first; reveal advanced metadata only on demand.
3. A persistent “continue learning” entry point for students rather than a dashboard full of tiles.
4. Use sentence-case labels and familiar verbs: Continue, Save, Publish, Grant access, Upload.
5. Empty, loading, error, and success states explain what happened and what the user can do next.
6. Destructive actions require a contextual confirmation with the consequence stated plainly.
7. No client-side business calculations decide access, completion, playback, or permissions.
8. Keyboard navigation, visible focus, readable contrast, reduced motion, and screen-reader labels are first-class requirements.
9. Responsive layouts adapt content priority rather than shrinking a desktop dashboard onto a phone.
10. Animation is limited to orientation and feedback; it never delays a user action.

## Technical baseline

- React + Vite + strict TypeScript.
- React Router in SPA mode with role-aware route metadata.
- TanStack Query for server state, request cancellation, retries, and cache invalidation.
- A typed API client generated or maintained from `docs/openapi.yaml`; no handwritten fetch calls inside components.
- Zod for runtime parsing of environment/configuration and external response boundaries where generated types are insufficient.
- React Hook Form for multi-field forms and accessible validation summaries.
- `hls.js` with native HLS fallback for the secure media player.
- Vitest + Testing Library for unit/component tests; Playwright for browser acceptance; axe checks in critical flows.
- A small local design system built from CSS variables and accessible primitives. Avoid a heavy component library unless a concrete accessibility or interaction need justifies it.
- Access tokens live only in memory. Refresh and media credentials remain HTTP-only cookies owned by the backend/Worker. Never place tokens in localStorage, sessionStorage, URLs, analytics events, or logs.

## Proposed frontend structure

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── route-policy.ts
│   ├── design-system/
│   │   ├── components/       # Button, Field, Dialog, Menu, Toast, Skeleton, etc.
│   │   ├── tokens.css
│   │   └── patterns/          # EmptyState, PageHeader, StatusLabel
│   ├── features/
│   │   ├── auth/
│   │   ├── student-learning/
│   │   ├── playback/
│   │   ├── account/
│   │   ├── owner-courses/
│   │   ├── owner-enrollments/
│   │   ├── owner-media/
│   │   └── owner-operations/
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   ├── StudentLayout.tsx
│   │   └── OwnerLayout.tsx
│   ├── lib/
│   │   ├── api/              # Typed transport, error envelope, auth refresh
│   │   ├── query/            # Query keys and cache policy
│   │   ├── media/            # HLS capability and player lifecycle
│   │   └── telemetry/        # Redacted client events only
│   ├── pages/
│   ├── test/
│   └── main.tsx
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Feature code owns its route components, query/mutation hooks, view models, and tests. Shared code is promoted only after two real consumers need it. Components do not import database concepts or Prisma types.

## Phased delivery

### Phase F0 — Product contract and interaction model

**Goal:** freeze the smallest useful navigation and visual language before building screens.

**Work:**

- Map every implemented backend route from `docs/openapi.yaml` to a frontend use case.
- Define student and owner information architecture, route map, navigation labels, and redirect rules.
- Define design tokens: typography scale, spacing, color roles, radii, focus ring, motion, and responsive breakpoints.
- Define the common states: loading, empty, validation error, expired session, forbidden/not-found, dependency unavailable, and retrying.
- Produce low-fidelity flows for the public landing page, login, first student landing, lesson watch, owner course edit, and upload processing.
- Decide the minimum browser support for native HLS and `hls.js`.

**Done when:** a new visitor understands what the LMS is and can reach login in one action; a new user can describe the next action on each core screen without a tour; and every planned screen maps to a backend contract.

### Phase F1 — Vite foundation and design system

**Goal:** establish a fast, accessible shell with no business features hidden inside shared components.

**Work:**

- Scaffold the Vite React TypeScript app with strict compiler settings and reproducible lockfile.
- Add router, query client, runtime environment validation, error boundary, and document title strategy.
- Implement tokens and foundational accessible primitives: Button, Link, IconButton, Field, Select, Dialog, Menu, Toast, Skeleton, Badge, and FormError.
- Add responsive Public, Student, and Owner layouts with one primary navigation area each.
- Add lint, format, typecheck, unit test, browser test, and production build scripts.

**Done when:** the empty app builds, has keyboard-complete navigation, passes an accessibility smoke test, and renders the shell at mobile and desktop widths.

### Phase F2 — Authentication and session UX

**Goal:** make entry and recovery feel simple while preserving backend session security.

**Work:**

- Build register, login, refresh/retry, logout, forgot-password, reset-password, and change-password flows.
- Connect the landing page primary CTA to login, and provide a quiet secondary registration path without competing with login.
- Redirect already-authenticated visitors from `/` to their role home; preserve the intended destination after login.
- Keep access tokens in an in-memory auth store; use `credentials: include` for refresh cookies.
- Handle a single coordinated refresh request when several queries receive 401 simultaneously.
- Build device/session management with a calm “where you are signed in” view and a focused revoke action.
- Add route intent preservation, role-aware redirects, and safe handling of expired/revoked sessions.

**Done when:** a student can register and log in without seeing token mechanics, refresh works after reload, logout invalidates the UI, and revoked access redirects to a useful sign-in state.

### Phase F3 — Student learning journey

**Goal:** provide a self-guiding consumption flow with minimal navigation.

**Work:**

- Build the student home with one Continue Learning card, enrolled-course list, and a small recent-progress section.
- Build course overview, section/lesson navigation, active enrollment messaging, and empty states.
- Build lesson view with progress, completion state, resources, and a single prominent Continue/Start action.
- Add progress mutation with optimistic-safe behavior, debouncing, cancellation, and server reconciliation.
- Add private resource download actions without exposing storage keys or credentials.

**Done when:** a student can sign in, find an enrolled course, open a lesson, resume progress, complete it, and access only permitted resources on desktop and mobile.

### Phase F4 — Secure HLS playback

**Goal:** make protected video feel like a native player while keeping media security invisible to users.

**Work:**

- Implement `SecureVideoPlayer` with native HLS first and `hls.js` fallback.
- Start a playback session only when the lesson view is ready; send heartbeats at the backend-defined interval.
- Persist and restore the server-provided position; stop timers, listeners, and HLS instances on teardown.
- Display a subtle moving, non-sensitive watermark using the server-provided session code; never display email, token, or storage data.
- Handle replacement, expired lease, revoked device, enrollment expiry, offline, and media gateway errors with actionable messages.
- Ensure media requests are same-origin with cookie credentials and never pass through NestJS video bytes.

**Done when:** a student can watch adaptive HLS, reload and resume, see the watermark move, and receive a clear recovery action when another device replaces the session.

### Phase F5 — Owner course and curriculum workspace

**Goal:** turn course management into a focused editor rather than an administrative dashboard.

**Work:**

- Build owner course list with draft/published/archived status and one contextual Create course action.
- Build course editor with section and lesson inline editing, reorder controls, text lesson editing, and publish/archive confirmation.
- Use autosave only where idempotency and conflict behavior are clear; otherwise provide one explicit Save action.
- Add student search and enrollment grant/edit/revoke flows with date and status validation.
- Hide owner navigation and actions for students, while relying on backend authorization for enforcement.

**Done when:** the owner can create, edit, reorder, publish, archive, and grant access without leaving the course workspace or learning hidden route conventions.

### Phase F6 — Owner media and operations

**Goal:** show only the operational information needed to make a decision.

**Work:**

- Build direct single-part and multipart upload flows with progress, cancellation, retry, and clear size/type feedback.
- Show processing status inline on the lesson/video, with failed reason and one Retry action.
- Show renditions and Activate action only when a video is ready; never show storage keys or signed URLs.
- Build least-data student support, audit/security views, and operational summary with pagination and redaction.
- Add polling only for active processing or explicit job state; pause polling when the page is hidden.

**Done when:** an owner can upload a video directly to storage, understand processing state, retry a failure, activate a ready version, and support a student without database access.

### Phase F7 — Resilience, accessibility, and performance

**Goal:** make the simple experience dependable under real network and device conditions.

**Work:**

- Add offline-aware query states, bounded retries, request cancellation, stale-data indicators, and retry actions.
- Add keyboard and screen-reader acceptance for forms, menus, dialogs, player controls, and tables.
- Test 320px mobile, tablet, desktop, reduced motion, high zoom, touch targets, and slow network.
- Add route-level code splitting, image/media lazy loading, query cache limits, and bundle budgets.
- Redact tokens/cookies/PII from client logs and error telemetry.
- Add Playwright flows for register/login → enrollment → lesson → playback → heartbeat → progress → resume, owner curriculum, upload, and authorization denial.

**Done when:** critical flows pass browser, accessibility, and throttled-network tests without duplicate submissions or leaked credentials.

### Phase F8 — Production release and handoff

**Goal:** ship a reproducible frontend artifact that matches the backend deployment contract.

**Work:**

- Validate production environment variables and API/media origins at build time.
- Build immutable static assets with cache-safe filenames and documented SPA fallback routing.
- Configure same-origin `/api` and `/media` behavior through the production ingress; no development proxy assumptions remain.
- Run the complete frontend and backend acceptance matrix against a clean environment.
- Verify refresh cookies, media cookies, CORS, CSP, error envelopes, and no-secret source/artifact scans.
- Document local development, deployment, rollback-compatible frontend behavior, and supported browser matrix.

**Done when:** a clean checkout can install, build, serve, and exercise the frontend against the production-shaped backend without manual route knowledge or secret exposure.

## Core route map

Public:

- `/` — minimalist landing page with a single primary path into the product.
- `/login`, `/register`, `/forgot-password`, `/reset-password`.

Student:

- `/learn` — continue learning and enrolled courses.
- `/learn/courses/:courseId` — course overview.
- `/learn/lessons/:lessonId` — lesson, resources, progress, and secure player.
- `/account/profile`, `/account/devices`, `/account/security`.

Owner:

- `/owner` — focused operational summary.
- `/owner/courses`, `/owner/courses/:courseId` — curriculum workspace.
- `/owner/students`, `/owner/students/:studentId` — least-data support.
- `/owner/operations` — audit, security, processing, and system state.

## Definition of frontend completion

The frontend is complete only when:

- all F0–F8 acceptance criteria are checked;
- every protected decision is confirmed by the backend, not only by UI state;
- no token, storage key, permanent playback URL, or credential appears in source, logs, URLs, or rendered responses;
- student and owner flows work on mobile and desktop with keyboard and screen-reader support;
- an unauthenticated visitor can understand the product from `/` and reach login without a tour;
- the clean-start backend acceptance and the browser acceptance suite both pass;
- no frontend work expands the deferred V1 product boundary.
