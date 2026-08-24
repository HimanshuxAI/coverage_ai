# Coverage Twin Phase C + D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one evidence-backed live Yoxa workflow journey and, only after public deployment plus a verified continuation contract, a secure external human-decision loop.

**Architecture:** Phase C extends the existing authoritative `workflow_runs` and aggregate contracts with server-enforced next-action selection, truthful acceptance/proof data, and one active-only refresh loop in the command center. Phase D remains gated: it adds a durable approval record, authenticated webhook correlation, idempotent decision handling, and Yoxa continuation only after the actual upstream callback contract and public HTTPS URL are known.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript, Supabase, Vitest, Yoxa public workflow triggers.

**Spec:** `/Users/himanshu/.codex/attachments/074c247b-f078-4c06-9139-3bb3896eb8c3/pasted-text.txt`

## Global Constraints

- Do not redesign landing, dashboard, case-command-center styling, workflows, or orchestration topology.
- Treat 202 as accepted/queued only; never as completion.
- Database rows stay snake_case; API/frontend DTOs remain camelCase.
- Presentation data never supplies execution, approval, decision, audit, health, packet, or completion state.
- Never call live Yoxa in automated tests.
- Do not configure external approval or change Yoxa until every Phase C gate passes and a public HTTPS callback plus documented continuation contract exist.
- Do not use a real golden case until the user identifies the safe case and its intended workflow.

---

### Task 1: Server-authoritative next-action policy

**Files:**
- Create: `src/lib/workflow/next-action.ts`
- Create: `src/lib/workflow/next-action.test.ts`
- Modify: `src/app/api/cases/[caseId]/process/route.ts`
- Modify: `src/lib/workflow/presentation.ts`

**Interfaces:**
- Produces: `getNextWorkflowKey(caseStatus, resolutionGraph): YoxaWorkflowKey | null`.
- Produces: `assertRequestedWorkflowIsNext(requested, context)` returning a typed rejection result.

- [ ] Write failing table-driven tests for `WAITING_FOR_ACTIVATION -> intake`, `ACTIVATED_VALIDATED -> preauth`, conditional branches, terminal/human-review rejection, and requested-key mismatch.
- [ ] Run `npm run test -- src/lib/workflow/next-action.test.ts`; confirm expected missing-module failure.
- [ ] Implement the smallest pure policy based only on current persisted case status and aggregate graph state.
- [ ] Make process route return `409 INVALID_NEXT_WORKFLOW` before run persistence/Yoxa invocation when the request does not match the server policy.
- [ ] Use the same policy result to drive the visible next-action copy; never infer it independently in JSX.
- [ ] Run focused tests and the existing process-route tests.

### Task 2: Truthful trigger/proof contract

**Files:**
- Create: `src/lib/yoxa/execution-proof.ts`
- Create: `src/lib/yoxa/execution-proof.test.ts`
- Modify: `src/lib/cases/contracts.ts`
- Modify: `src/lib/cases/aggregate.ts`
- Modify: `src/app/api/cases/[caseId]/process/route.ts`
- Modify: `src/app/api/cases/[caseId]/route.ts`

**Interfaces:**
- Produces: `ExecutionProof` from persisted run fields and accepted upstream result.
- Produces: API DTO evidence for durable-run creation, request dispatch, accepted response, and current run status.

- [ ] Write failing tests proving accepted 202 maps to `accepted`, not `completed`; missing Yoxa execution ID remains absent; and existing active run yields resume-tracking proof.
- [ ] Run the focused test and confirm RED.
- [ ] Preserve upstream response status in the run; return local `202 Accepted` only after durable persistence and accepted Yoxa trigger, otherwise retain truthful failure status.
- [ ] Add `agent_run_id`/run correlation to trigger audit data only where the schema supports it.
- [ ] Run aggregate/process/proof test suites.

### Task 3: Active-run lifecycle and Phase C UI model

**Files:**
- Create: `src/lib/yoxa/status-presentation.ts`
- Create: `src/lib/yoxa/status-presentation.test.ts`
- Modify: `src/lib/cases/command-center.ts`
- Modify: `src/lib/cases/command-center.test.ts`
- Modify: `src/app/dashboard/cases/[caseId]/page.tsx`

**Interfaces:**
- Produces: `getWorkflowStatusPresentation(status)` with label, tone, active, terminal, and polling flags.
- Produces: `shouldPollWorkflowRuns(runs)` and a view model for execution proof/inspector/activity.

- [ ] Write failing tests for every persisted run status, active/terminal detection, case-state/run-state separation, proof strip truth, run inspector fields, and unavailable proof data.
- [ ] Run focused status/view-model tests and confirm RED.
- [ ] Implement centralized presentation from actual `WorkflowRunStatus` only.
- [ ] Render one next valid action, initial submission state, accepted-not-completed proof strip, persisted audit feed, and full inspector fields without exposing secrets.
- [ ] Keep conditional Material Change/Appeal out of the mandatory main path.
- [ ] Run focused tests and TypeScript.

### Task 4: One safe active-only aggregate poller

**Files:**
- Create: `src/lib/cases/active-refresh.ts`
- Create: `src/lib/cases/active-refresh.test.ts`
- Modify: `src/app/dashboard/cases/[caseId]/page.tsx`

**Interfaces:**
- Produces: `createActiveRefreshController(fetchAggregate, options)` with one active request, AbortController cleanup, active-only scheduling, and retry-visible state.

- [ ] Write failing tests for queued/triggering/running/waiting states starting refresh, terminal/no-run stopping, no overlap, cleanup abort, duplicate StrictMode-safe start, and transient refresh failure retaining authoritative run state.
- [ ] Run focused tests and confirm RED.
- [ ] Implement a 3–5 second active-only refresh controller; do not mutate a run to failed on a read error.
- [ ] Reuse the existing aggregate fetch rather than creating a second polling architecture.
- [ ] Render `LIVE UPDATE INTERRUPTED` while retaining the last authoritative snapshot.
- [ ] Run focused tests, command-center tests, lint, and build.

### Task 5: Phase C local gate and safe golden-case readiness

**Files:**
- Modify: Phase C test files above only if a failing evidence gap is found.
- Create: `docs/r0/phase-c-contract-evidence.md`

- [ ] Run all Phase C unit/route tests, full `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Verify the process endpoint rejects invalid/non-next workflow keys without side effects.
- [ ] Verify duplicate active-run behavior against a controlled repository/client test double.
- [ ] Document actual local run response shape, accepted semantics, inspector fields, polling start/stop conditions, and all unmet live gates.
- [ ] Stop before any live trigger until the user identifies the safe golden case and intended workflow key.

### Task 6: Public deployment and Yoxa continuation discovery gate

**Files:**
- Create: `docs/r0/phase-d-deployment-and-yoxa-contract.md`

- [ ] Identify the approved hosting target and public production domain.
- [ ] Verify the deployed `/`, `/dashboard`, `/dashboard/cases/<golden-case>`, `/api/health`, and webhook route over HTTPS.
- [ ] Record environment-variable presence only; never place values in documentation.
- [ ] Obtain the official Yoxa webhook authentication and continuation/resume contract: endpoint, IDs, canonical actions, signing/auth, idempotency, retry behavior, and success semantics.
- [ ] Stop if any contract element is unknown; do not invent a resume endpoint or switch a Yoxa node.

### Task 7: Durable authenticated approval persistence

**Files:**
- Create: `supabase/migrations/004_approval_requests.sql`
- Create: `src/lib/approvals/contracts.ts`
- Create: `src/lib/approvals/repository.ts`
- Create: matching Vitest tests
- Modify: `src/app/api/yoxa/approvals/webhook/route.ts`
- Modify: `src/lib/cases/contracts.ts`
- Modify: `src/lib/cases/aggregate.ts`

**Interfaces:**
- Produces: pending approval DTO correlated to approval ID, case ID, workflow run ID, Yoxa execution ID, packet, graph, status, and immutable idempotency identity.

- [ ] Write failing tests for authenticated payload rejection, unknown/missing correlation rejection, duplicate webhook reuse, and audit insertion.
- [ ] Run focused tests and confirm RED.
- [ ] Add a durable approval table and exact uniqueness constraints derived from the verified Yoxa payload.
- [ ] Verify webhook authentication using Yoxa-supported authentication only; reject missing/invalid case/run correlation and never default IDs.
- [ ] Move the correlated run to `WAITING_FOR_HUMAN` only after durable approval persistence.
- [ ] Expose the persisted approval—not a timer or status guess—in the aggregate.
- [ ] Run focused tests, migration validation, full test/lint/build.

### Task 8: Human-review cockpit and idempotent decision command

**Files:**
- Create: `src/lib/approvals/decision.ts`
- Create: matching tests
- Modify: `src/app/api/approvals/[approvalId]/decision/route.ts`
- Modify: `src/app/dashboard/cases/[caseId]/page.tsx`

- [ ] Write failing tests for actual pending approval requirement, supported decision mapping, reason requirements, duplicate identical decision idempotency, conflicting decision rejection, and local-persisted/remote-pending state.
- [ ] Run focused tests and confirm RED.
- [ ] Replace the loose decision route semantics with the durable approval contract; do not synthesize packet/run/case correlation.
- [ ] Render the cockpit only from a pending approval record; bind recommendation/evidence/exceptions to persisted aggregate data and render unavailable states truthfully.
- [ ] Disable controls while submitting and provide semantic keyboard-accessible actions.
- [ ] Run focused tests and browser verification.

### Task 9: Verified Yoxa continuation and one external HITL run

**Files:**
- Create: `src/lib/yoxa/continuation.ts`
- Create: matching tests
- Modify: decision route and aggregate/UI only as required by the verified contract.

- [ ] Write failing tests from the official continuation contract: payload, ID correlation, idempotency key, successful acknowledgment, and retry-safe local-persisted/remote-failure behavior.
- [ ] Run focused tests and confirm RED.
- [ ] Implement the smallest server-only continuation client; do not mark the run complete before authoritative upstream completion.
- [ ] Deploy public HTTPS callback and configure only the selected golden workflow’s external approval node.
- [ ] Run exactly one approved golden case through trigger, webhook, decision, continuation, resume, terminal workflow state, final case update, audit closure, and packet generation.
- [ ] Capture only non-secret IDs/timestamps in the final evidence record.

### Task 10: Final C+D gate

**Files:**
- Create: `docs/r0/phase-c-d-golden-case-evidence.md`

- [ ] Run `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Verify production routes and webhook reachability.
- [ ] Verify the complete case/run/approval/decision/continuation/terminal-state/packet chain from persisted records.
- [ ] Record failures honestly; do not begin another product phase after a pass.
