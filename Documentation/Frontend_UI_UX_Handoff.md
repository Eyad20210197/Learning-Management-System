# Frontend UI/UX Handoff

Date: 2026-08-15

## User Scope

- Work only in the frontend UI/UX.
- Do not audit or modify backend/configuration.
- Fully replace only the landing page with the prototype landing page.
- For the rest of the student experience, match the prototype UI/UX while keeping current naming, content, user flow, routes, and API contracts.
- Do not leave placeholder/tutorial components or graphics in the UI.
- Fix mobile viewport bugs where horizontally scrollable sections move out of view.

## Prototype Source

- ZIP: `frontend/my-app.zip`
- Extracted during this pass to: `frontend/.prototype-work/my-app`
- The prototype is a single Vite/React landing page for `FirstCommit`.
- Prototype files include:
  - `src/App.tsx`
  - `src/App.css`
  - `src/Lightfall.tsx`
  - `src/Lightfall.css`
  - `src/reactbits/*`
  - `src/assets/hero.png`
  - `public/icons.svg`
  - `public/favicon.svg`

## Current Frontend Architecture Learned

- Frontend app is Vite + React 19 + TypeScript.
- Routing lives in `frontend/src/App.tsx`.
- `/` lazy-loads `FirstCommitLandingPage`.
- `PublicLayout` skips the normal app chrome on `/`, so the landing page owns its own header/footer.
- Student flow routes:
  - `/login`
  - `/register`
  - `/learn`
  - `/learn/courses/:courseId`
  - `/learn/lessons/:lessonId`
- Owner routes also exist, but were not intentionally reworked.
- API contracts live in `frontend/src/lib/api.ts`.
- Student pages use `learningApi.myCourses`, `learningApi.course`, `learningApi.lesson`, `learningApi.progress`, `learningApi.createPlayback`, and `learningApi.downloadResource`.

## Landing Page Findings

- The app already had most prototype assets and components copied in:
  - `src/pages/FirstCommitLandingPage.tsx`
  - `src/styles/firstcommit-landing.css`
  - `src/components/landing/Lightfall.tsx`
  - `src/components/landing/reactbits/*`
  - `src/assets/firstcommit-hero.png`
- `src/assets/firstcommit-hero.png` matches the prototype `src/assets/hero.png` by file hash.
- Current landing route uses real `/login` links instead of the prototype email capture form. Keep that, because it preserves real user flow and the existing landing test asserts those CTAs route to `/login`.
- `src/pages/LandingPage.tsx` is a legacy/simple landing component and is not used by `App.tsx`.

## Changes Made

- `src/pages/LearnPage.tsx`
  - Added `student-dashboard`, `student-hero-panel`, and `student-course-card` classes for scoped student styling.
  - Did not change API calls, route targets, or course data rendering.

- `src/pages/CoursePage.tsx`
  - Wrapped the course intro/progress/start CTA in `student-hero-panel`.
  - Added `student-course-page` class.
  - Added `is-complete` class to completed lesson rows for styling.
  - Did not change API calls, route targets, lesson ordering, or displayed names/content.

- `src/pages/LessonPage.tsx`
  - Wrapped lesson intro content in `student-hero-panel`.
  - Added `student-lesson-page` class.
  - Did not change playback, downloads, progress mutation, or route behavior.

- `src/components/ParentPageLink.tsx`
  - Replaced the hand-written SVG arrow with Lucide `ChevronLeft`.

- `src/styles/tokens.css`
  - Added prototype-aligned tokens: `--lime`, `--orange`, `--green`, `--night`, `--night-soft`, `--mono`, etc.

- `src/styles/app.css`
  - Added a scoped visual pass for the app shell, auth screen, student dashboard, course page, and lesson page.
  - Header/auth/button styling now aligns more with the prototype's dark/lime/purple language.
  - Student course cards, progress bars, lesson sections, resource cards, and complete buttons received prototype-inspired styling.
  - Added mobile overrides for the student pages.

- `src/styles/firstcommit-landing.css`
  - Added a final `@media (max-width: 760px)` override.
  - Mobile non-hero sections now use normal document height instead of forced viewport-height grids.
  - Mobile course/feature horizontal scrollers now use `height: auto`, `max-height: none`, and visible snap-start behavior so cards do not sit out of view.

## Validation Run

Important: PowerShell blocks `npm.ps1` on this machine, so use `npm.cmd`.

Commands that passed:

```powershell
npm.cmd run typecheck
npm.cmd run test -- LandingPage.test.tsx
npm.cmd run format:check
npm.cmd run build
```

Lint result:

```powershell
npm.cmd run lint
```

- Passed with one existing warning in `src/app/auth.tsx`:
  - `react(only-export-components): Fast refresh only works when a file only exports components.`
- That warning was not introduced by this UI pass.

Build note:

- Production build passed.
- Vite reported a large chunk warning, mostly around app/HLS/landing bundles. No build failure.

## Dev Server Attempt

- A dev server start was attempted with:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

- The user interrupted that turn while the command was running.
- Log files were created:
  - `frontend/.vite-dev.out.log`
  - `frontend/.vite-dev.err.log`
- The output log said port `5173` was already in use and Vite moved to:
  - `http://127.0.0.1:5174/`
- A later listener check did not confirm the server was still alive, so the next agent should verify before relying on it.

## Current Working Tree Notes

Expected modified files from this pass:

- `frontend/src/components/ParentPageLink.tsx`
- `frontend/src/pages/CoursePage.tsx`
- `frontend/src/pages/LearnPage.tsx`
- `frontend/src/pages/LessonPage.tsx`
- `frontend/src/styles/app.css`
- `frontend/src/styles/firstcommit-landing.css`
- `frontend/src/styles/tokens.css`

Expected untracked/generated files:

- `frontend/.prototype-work/`
- Possibly `frontend/.vite-dev.out.log`
- Possibly `frontend/.vite-dev.err.log`

The prototype extraction folder is useful for comparison but should not be committed unless the user explicitly wants it.

## Next-Agent Priorities

- Do visual QA in a browser, especially mobile widths around 360-430px.
- Check landing sections: courses, benefits, process, FAQ, CTA.
- Check authenticated student pages with real or seeded data:
  - `/learn`
  - `/learn/courses/:courseId`
  - `/learn/lessons/:lessonId`
- Confirm horizontal mobile scrollers are visible and reachable.
- Do not change `frontend/src/lib/api.ts` unless the user explicitly asks.
- Do not audit backend/configuration.
- Preserve `/login` CTAs on the landing page unless the user explicitly accepts replacing them with the prototype's non-API email capture.
