# Coverage Twin R0 Contract and Truth Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every judge-facing dashboard and case-command-center state traceable to the current API/database contract without adding Phase C behavior.

**Architecture:** Keep the existing orchestration and route topology. Add small pure boundary modules for process request validation, aggregate DTO normalization/failure semantics, and dashboard metrics; route handlers and pages consume those stable contracts. Database rows remain snake_case while API/frontend DTOs are camelCase.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript 5, Supabase, Vitest.

**Spec:** `/Users/himanshu/.codex/attachments/230d6571-f2a3-4ef0-9fb7-99c650f010d8/pasted-text.txt`

## Global Constraints

- Do not redesign orchestration or add Phase C polling/HITL functionality.
- Preserve the current Coverage Twin visual palette and layout.
- Database representation remains snake_case; API/frontend contracts use camelCase.
- Never use presentation data for execution state, workflow IDs, audit, decisions, approvals, health, or completion.
- Every behavior repair follows red-green-refactor.
- Do not restore, delete, stage, or commit unrelated user changes.

---

### Task 1: Minimal test foundation and contract tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`
- Create: `src/lib/yoxa/process-request.test.ts`
- Create: `src/lib/cases/aggregate.test.ts`
- Create: `src/lib/dashboard/metrics.test.ts`

**Interfaces:**
- Produces: `parseProcessRequest`, `buildProcessRequestBody`, `buildCaseAggregate`, `calculateDashboardMetrics` behavior specifications.

- [ ] Install only `vitest` and `vite-tsconfig-paths` as dev dependencies.
- [ ] Add `test` and `test:watch` scripts.
- [ ] Write failing tests for canonical workflow keys, missing/invalid keys, selected key preservation, aggregate envelope/row normalization, named read failures, real zero metrics, and real-data precedence.
- [ ] Run `npm run test` and confirm failures are caused by missing contract modules.

### Task 2: Process action contract

**Files:**
- Create: `src/lib/yoxa/process-request.ts`
- Modify: `src/app/api/cases/[caseId]/process/route.ts`
- Modify: `src/app/dashboard/cases/[caseId]/page.tsx`

**Interfaces:**
- Produces: `parseProcessRequest(body: unknown): ProcessRequestParseResult` and `buildProcessRequestBody(workflowKey: YoxaWorkflowKey): { workflowKey: YoxaWorkflowKey }`.

- [ ] Implement the smallest validator against registry-backed canonical keys.
- [ ] Reject missing/invalid keys with `400 INVALID_WORKFLOW_KEY` before database or Yoxa access.
- [ ] Remove route fallback-to-intake selection.
- [ ] Make the UI send `{ workflowKey }`.
- [ ] Run focused tests and confirm both `preauth` and `discharge` remain selected.

### Task 3: Aggregate API contract and failure semantics

**Files:**
- Create: `src/lib/cases/contracts.ts`
- Create: `src/lib/cases/aggregate.ts`
- Modify: `src/app/api/cases/[caseId]/route.ts`
- Expand: `src/lib/cases/aggregate.test.ts`

**Interfaces:**
- Produces: `ApiEnvelope<T>`, `CaseAggregate`, camelCase DTOs, `AggregateReadError`, and `buildCaseAggregate(input)`.

- [ ] Implement explicit database-row-to-DTO mapping for case, workflow runs, evidence, graph, decisions, packets, and audit events.
- [ ] Classify all six judge-facing related reads as required.
- [ ] Return `502 AGGREGATE_READ_FAILED` with exact source names when any required read fails.
- [ ] Preserve empty arrays/null only for successful queries with no records.
- [ ] Run aggregate tests and verify normalization and failure distinction pass.

### Task 4: Dashboard truth semantics

**Files:**
- Create: `src/lib/dashboard/metrics.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/dashboard/page.tsx`
- Expand: `src/lib/dashboard/metrics.test.ts`

**Interfaces:**
- Produces: `DashboardMetrics`, `HealthStatus`, and `calculateDashboardMetrics(cases)`.

- [ ] Implement exact count calculation with zero preserved.
- [ ] Surface case-query failures as unavailable state.
- [ ] Make health report database reachability and workflow configuration only.
- [ ] Render the fetched health DTO; remove connected/deployed/audit/governance assertions not verified by the endpoint.
- [ ] Rename live/real-time copy to current snapshot semantics; do not add polling.
- [ ] Order audit reads by `created_at` if retained, or remove the unused dashboard audit query.
- [ ] Run metric/health tests.

### Task 5: Command-center live data repair

**Files:**
- Modify: `src/app/dashboard/cases/[caseId]/page.tsx`
- Modify: `src/lib/workflow/presentation.ts` only where presentation/live separation requires it.

**Interfaces:**
- Consumes: `ApiEnvelope<CaseAggregate>` and camelCase aggregate DTOs.

- [ ] Unwrap and validate `json.data` without compatibility guessing.
- [ ] Render loading, request failure, and no-record states.
- [ ] Bind header and domain cards to real case fields.
- [ ] Replace unsupported recommendation factors with persisted decision reason, graph reason codes, and evidence report statuses.
- [ ] Render persisted evidence count/provenance without claiming four verified artifacts.
- [ ] Render real workflow statuses and inspector timestamps; never fabricate duration.
- [ ] Render real audit events and decision packet, or explicit empty states.
- [ ] Refresh once after a successful manual trigger; do not poll.

### Task 6: Use-time integration validation

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/lib/yoxa/registry.ts`
- Create or expand: `src/lib/yoxa/process-request.test.ts`

**Interfaces:**
- Produces: a small required-value validator invoked when retrieving a workflow definition for execution.

- [ ] Add a failing test proving a missing workflow secret fails with a clear configuration error.
- [ ] Implement use-time URL/secret validation without breaking build-time module evaluation.
- [ ] Keep server secrets out of client DTOs and logs.
- [ ] Run focused tests.

### Task 7: Lint repair and complete verification

**Files:**
- Modify: product files reported by ESLint.
- Modify: `eslint.config.mjs` only to align generated/Deno exclusions with `tsconfig.json`; do not weaken rules.

**Interfaces:**
- Produces: clean test, lint, and build commands.

- [ ] Fix application `any`, hook ordering, unused-state, and escaping errors.
- [ ] Remove unused variables in standalone landing assets/components where safe.
- [ ] Exclude `supabase/functions/**` from the Next application lint scope because it is an independent Deno surface already excluded from application TypeScript.
- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Verify `/`, `/dashboard`, `/dashboard/cases/CASE-CT-REAL-001`, `/api/health`, and the aggregate API locally.
- [ ] Send an invalid process key and verify `400 INVALID_WORKFLOW_KEY` with no external trigger.
- [ ] Compare rendered values to the aggregate response.

### Task 8: Final repository audit

**Files:**
- No destructive changes.

- [ ] Re-run `git status --short`, `git diff --stat`, `git diff`, and `git ls-files --deleted`.
- [ ] Classify final modified/untracked/deleted entries.
- [ ] Record that scoped OpenAPI migration is incomplete for several deleted flat specs; leave them untouched.
- [ ] Produce the required R0 PASS/FAIL report and explicitly state Phase C readiness.
