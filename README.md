# Coverage Twin

Coverage Twin is a Next.js 16 application for operating a six-workflow health-coverage case lifecycle across a landing page, an operations dashboard, and a case command center.

## Production

- Live URL: `https://coverageai-production.up.railway.app`
- Read-only production checks on August 24, 2026 returned `200` for `/`, `/dashboard`, and `/api/health`.
- Production `/api/health` reported `status: "ok"`, `database.configured: true`, `database.reachable: true`, and all six workflow configs present.
- The hardening documented in this repository is local work until a future push and deploy. Read-only production HTML still shows older metadata on `/` and `/dashboard`, so do not assume the local Task 1-5 changes are live.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - all six `YOXA_*_TRIGGER_URL` and `YOXA_*_SECRET` pairs
   - `YOXA_WEBHOOK_SECRET`
3. Install dependencies with `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Architecture

- `/` is the marketing/landing surface.
- `/dashboard` is the operations dashboard.
- `/dashboard/cases/[caseId]` is the case command center.
- `/api/health` provides the dashboard health snapshot.
- `/api/cases/[caseId]` provides the aggregate case envelope used by the command center.
- `/api/cases/[caseId]/process` is the existing workflow-processing route.
- Supabase is the persisted system of record for case, decision, packet, audit, and workflow-run state.
- Yoxa provides the six workflow deployments; the app stores only the workflow keys, configuration presence, and persisted run evidence it can prove.

## Six Workflows

1. `intake` — intake normalization and context setup
2. `preauth` — planned cashless pre-authorisation
3. `materialChange` — re-evaluation after a material fact change
4. `discharge` — discharge evidence collection
5. `settlement` — final bill reconciliation and settlement
6. `appeal` — dispute and appeal resolution

## Current Guarantees

- Landing page CTAs now resolve to `/dashboard` or meaningful in-page sections; no dead CTA remains in the hardened local build.
- Dashboard controls are aggregate-backed: refresh, search, sort, status filters, featured-case links, and health/config panels all read from real snapshot sources instead of fabricated counters or status copy.
- Command center sections are aggregate-backed: case record, decision, governance state, workflow execution trail, audit trail, and packet truth all render from the aggregate DTO or explicit no-record/unavailable states.
- Command-center manual refresh reuses the aggregate GET path; it does not introduce a new workflow trigger.
- Copy actions are limited to safe identifiers only.
- Packet actions appear only when a real packet PDF URL exists.
- Responsive and print hardening preserves case data while hiding navigation and action chrome in print mode.

## Sanitized Production Proof

- Read-only production route check:
  - `/` → `200`
  - `/dashboard` → `200`
  - `/api/health` → `200`
- Read-only local route smoke check against the hardened build:
  - `/` → `200`
  - `/dashboard` → `200`
  - `/dashboard/cases/CASE-CT-REAL-001` → `200`
  - `/api/health` → `200`
  - `/api/cases/CASE-CT-REAL-001` → `200`
- The current local aggregate snapshot for `CASE-CT-REAL-001` shows:
  - top-level case `status: "AUTHORISED_BY_HUMAN"`
  - `pendingApproval: null`
  - `latestPacket.packetId: "PKT-CASE-CT-REAL-001-V1"`
  - a persisted discharge workflow run in `RUNNING`

## Verification

- `npm run test` → passed on August 24, 2026 (`15` files, `125` tests)
- `npm run lint` → passed
- `npm run build` → passed
- `curl http://127.0.0.1:3301/{,/dashboard,/dashboard/cases/CASE-CT-REAL-001,/api/health,/api/cases/CASE-CT-REAL-001}` → all returned `200` during local smoke verification

## Out Of Scope

Phase D / HITL product work is intentionally out of scope for this hardening pass. This README does not claim native human-approval controls, webhook-resume completion, new orchestration behavior, or any live workflow trigger verification beyond the existing read-only evidence above.
