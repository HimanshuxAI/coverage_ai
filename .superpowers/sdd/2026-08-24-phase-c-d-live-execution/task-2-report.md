# Task 2 Report — Truthful trigger/proof contract

Date: 2026-08-24

## Outcome

Task 2 is implemented without schema migrations or live Yoxa calls.

- Yoxa `202 Accepted` is now preserved as accepted-only proof, never inferred as completion.
- Workflow-run proof is derived from persisted workflow-run evidence.
- Duplicate active runs now return resume-tracking proof.
- The process route preserves upstream failure status instead of fabricating `502` for all trigger failures.
- Trigger audit inserts now correlate the persisted workflow run through supported fields only.

## Files changed

- `src/lib/yoxa/execution-proof.ts`
- `src/lib/yoxa/execution-proof.test.ts`
- `src/lib/cases/contracts.ts`
- `src/lib/cases/aggregate.ts`
- `src/lib/cases/aggregate.test.ts`
- `src/app/api/cases/[caseId]/process/route.ts`
- `src/app/api/cases/[caseId]/process/route.test.ts`
- `src/lib/yoxa/runs.ts`
- `src/lib/cases/command-center.test.ts`

## Design notes

- Added a pure `buildExecutionProof` mapper that reads:
  - durable run evidence from persisted workflow-run identifiers/timestamps
  - dispatch evidence from persisted `started_at`
  - accepted-response evidence from persisted `raw_response.statusCode`
  - current run truth from persisted workflow-run status/timestamps
- The route now persists upstream trigger evidence as:
  - `raw_response.statusCode`
  - `raw_response.body`
  - `raw_response.rawBody`
- `updateWorkflowRunState` now extracts `workflow_run_id` from nested persisted response bodies so `yoxa_execution_id` still backfills when present.
- Aggregate workflow-run DTOs now expose `executionProof` directly.
- Fresh accepted triggers return local `202` only after run persistence and accepted upstream response.
- Duplicate active runs keep the existing `200` response but add `resume-tracking` proof, because the current request resumed an already-persisted active run rather than creating a new accepted trigger.

## RED evidence

Observed before implementation:

- `src/lib/yoxa/execution-proof.test.ts` failed because the proof module did not exist.
- `src/lib/cases/aggregate.test.ts` failed because aggregate workflow runs had no `executionProof`.
- `src/app/api/cases/[caseId]/process/route.test.ts` failed because:
  - accepted upstream triggers still returned `200`
  - duplicate active runs returned no proof
  - trigger failures still returned synthetic `502`

Focused RED command:

```bash
npm test -- src/lib/yoxa/execution-proof.test.ts src/lib/cases/aggregate.test.ts 'src/app/api/cases/[caseId]/process/route.test.ts'
```

## GREEN evidence

Focused task suites:

```bash
npm test -- src/lib/yoxa/execution-proof.test.ts src/lib/cases/aggregate.test.ts 'src/app/api/cases/[caseId]/process/route.test.ts'
```

Result: `3` files passed, `20` tests passed.

Expanded regression sweep:

```bash
npm test -- src/lib/cases/command-center.test.ts src/lib/yoxa/execution-proof.test.ts src/lib/cases/aggregate.test.ts 'src/app/api/cases/[caseId]/process/route.test.ts'
```

Result: `4` files passed, `33` tests passed.

Static verification:

```bash
npx eslint src/lib/yoxa/execution-proof.ts src/lib/yoxa/execution-proof.test.ts src/lib/cases/contracts.ts src/lib/cases/aggregate.ts src/lib/cases/aggregate.test.ts src/lib/cases/command-center.test.ts 'src/app/api/cases/[caseId]/process/route.ts' 'src/app/api/cases/[caseId]/process/route.test.ts' src/lib/yoxa/runs.ts
npx tsc --noEmit
git diff --check -- src/lib/yoxa/execution-proof.ts src/lib/yoxa/execution-proof.test.ts src/lib/cases/contracts.ts src/lib/cases/aggregate.ts src/lib/cases/aggregate.test.ts 'src/app/api/cases/[caseId]/process/route.ts' 'src/app/api/cases/[caseId]/process/route.test.ts' src/lib/yoxa/runs.ts
```

Result: all passed.

## Concerns / follow-up

- `resume-tracking` proof is currently emitted only by the process route for duplicate active-run requests; the persisted workflow-run row alone does not encode that the latest client action was a resume rather than a fresh trigger.
- The command-center runtime validator still treats `executionProof` as an allowed extra field rather than explicitly validating it. That is safe for this task because the UI does not consume the field yet, but Task 3 should tighten that validator when the proof becomes a rendered contract.
