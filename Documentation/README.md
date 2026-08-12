# LMS Documentation

## Canonical v1 specification

The current source of truth for implementation is [LMS V1 JavaScript Implementation Plan](LMS_V1_JavaScript_Implementation_Plan.md).

It defines the agreed product and technical decisions:

- one `OWNER` who creates and controls all course content;
- `STUDENT` accounts that consume only their active enrollments;
- JavaScript for both the NestJS backend and React frontend;
- HLS-only video playback for v1;
- private Cloudflare R2 storage served through a same-origin Cloudflare Worker media gateway;
- a React/Vite static SPA, with NestJS as the sole business and authorization backend.

## Historical documents

- `LMS_Backend_Implementation_Plan_Single_Owner_Localhost.md` contains the original broad backend design. Its role model is still useful, but the canonical plan overrides its implementation details.
- `LMS_Full_Roadmap_Documentation.docx` is a historical roadmap. It includes earlier multi-instructor and TypeScript assumptions that are not part of v1.

When a historical document conflicts with the canonical plan, follow the canonical plan.
