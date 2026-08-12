# ADR-0001: Use strict TypeScript and initialize the backend foundation in Phase 0

- Status: Accepted
- Date: 2026-08-11
- Decider: Project owner

## Context

`Documentation/LMS_V1_JavaScript_Implementation_Plan.md` describes JavaScript-only application source, contract freezing as Phase 0, and framework initialization as Phase 1. In the subsequent project conversation, the owner explicitly approved TypeScript and requested the NestJS framework, folder structure, dependencies, database, infrastructure, and core modules as "Phase 0."

Implementing that instruction without recording it would leave the repository with two contradictory sources of direction. The original plan is intentionally preserved until it can be revised and reviewed as a whole.

## Decision

1. New application source will use strict TypeScript. NestJS applications, background workers, edge workers, and scripts use `.ts`; React source uses `.ts` and `.tsx` when that application is introduced.
2. The current delivery is named **Phase 0 — Backend foundation**. It establishes the NestJS workspace, architecture boundaries, configuration, observability, database, Redis, BullMQ, Docker, tests, and developer workflow.
3. The original contract-freezing work remains required and is not considered complete merely because the foundation is now called Phase 0. Later phase numbering must be reconciled before those phases begin.
4. The backend is a modular monolith with separate `api` and `video-worker` application entry points. Business contexts remain isolated libraries; infrastructure is composed through the platform layer.
5. This ADR overrides only the source-language decision and the name/order of the current foundation phase. The plan's single-owner product boundary, authorization rules, private-R2/HLS design, security requirements, and deferred features remain unchanged.

## Consequences

- NestJS decorators, DTOs, dependency injection contracts, Prisma types, queue payloads, and cross-application refactoring receive compile-time checking.
- Strict compilation, linting, formatting, tests, Prisma generation, and both application builds become required quality gates.
- TypeScript remains a build-time tool; deployed applications still execute compiled JavaScript.
- The frontend and Cloudflare media gateway are not created by this foundation phase even though their future source language is now TypeScript.
- Before product feature work advances, the authoritative implementation plan should be updated or superseded so its language and phase labels agree with this accepted decision.
