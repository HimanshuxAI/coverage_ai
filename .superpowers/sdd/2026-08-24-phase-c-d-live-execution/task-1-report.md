# Task 1 Report — Server-authoritative next-action policy

Date: 2026-08-24

## Outcome

Implemented a shared next-workflow policy and moved the process route to enforce it before workflow-run persistence or Yoxa triggering. The same policy now drives presentation workflow selection instead of maintaining a second workflow-key switch.

## RED evidence

1. `npm run test -- src/lib/workflow/next-action.test.ts`
   - Failed with `Cannot find module './next-action' imported from src/lib/workflow/next-action.test.ts`.
2. `npm run test -- 'src/app/api/cases/[caseId]/process/route.test.ts'`
   - Failed on the new mismatch case with `expected 500 to be 409`, proving the route still crossed into orchestration instead of rejecting a valid-but-not-next workflow.

## Changes made

- Added `src/lib/workflow/next-action.ts`
  - `getNextWorkflowKey(caseStatus, resolutionGraph)` returns the next valid workflow key or `null`.
  - `assertRequestedWorkflowIsNext(requestedWorkflowKey, context)` returns a typed `INVALID_NEXT_WORKFLOW` rejection with authoritative context.
- Added `src/lib/workflow/next-action.test.ts`
  - Table-driven coverage for main path, conditional branches, terminal/human-review null cases, and mismatch rejection.
- Updated `src/app/api/cases/[caseId]/process/route.ts`
  - Reads the latest persisted `resolution_graphs.graph_state`.
  - Rejects non-next but otherwise valid workflow requests with `409 INVALID_NEXT_WORKFLOW` before workflow-run persistence or Yoxa calls.
  - Returns `502 RESOLUTION_GRAPH_READ_FAILED` if the route cannot read the graph state it depends on.
- Updated `src/app/api/cases/[caseId]/process/route.test.ts`
  - Added the route-level regression proving a valid-but-not-next workflow is rejected before persistence.
  - Expanded the Supabase test double to include the `resolution_graphs` read.
- Updated `src/lib/workflow/presentation.ts`
  - Uses `getNextWorkflowKey(...)` for `targetWorkflowKey` so UI workflow selection no longer independently infers the next workflow key.
  - Keeps the existing status copy, but switches the `WAITING_FOR_EVIDENCE`/`EVIDENCE_RESOLVED` action label to `RE-EVALUATE CASE` when the graph indicates a material-change branch.

## Simplifications made

- Kept the policy pure and limited to persisted case status plus the latest aggregate graph state.
- Reused status-specific presentation copy instead of redesigning command-center text or action rendering.
- Did not add workflow history, run-history branching, or any Phase D behavior.

## Verification

- `npm run test -- src/lib/workflow/next-action.test.ts`
  - Passed: `9 passed`
- `npm run test -- 'src/app/api/cases/[caseId]/process/route.test.ts'`
  - Passed: `5 passed`
- `npm run test -- src/lib/yoxa/process-request.test.ts`
  - Passed: `23 passed`
- `npx tsc --noEmit`
  - Passed with exit code `0`
- `npm run build`
  - Passed; Next.js production build completed successfully.

## Remaining concerns

- The policy only uses aggregate graph state to distinguish the material-change branch for `WAITING_FOR_EVIDENCE`. There is still no persisted branch-history field, so the helper intentionally stays conservative instead of inventing richer orchestration state.
- `src/lib/workflow/presentation.ts` was already an untracked workspace file before this task. It is a Task 1 file and was edited in place, but its pre-existing untracked state is worth preserving in the handoff context.
