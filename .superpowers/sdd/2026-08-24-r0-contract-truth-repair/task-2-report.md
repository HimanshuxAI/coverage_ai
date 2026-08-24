# Task 2 Report — Process action contract

## Status

Completed.

## What changed

- Added `src/lib/yoxa/process-request.ts` with:
  - `parseProcessRequest(body)` to validate canonical `workflowKey` values against the registry keys
  - `buildProcessRequestBody(workflowKey)` to build the request payload shape used by the UI
- Updated `src/app/api/cases/[caseId]/process/route.ts` to:
  - parse `request.json()` once
  - reject missing or invalid `workflowKey` with `400 INVALID_WORKFLOW_KEY`
  - remove status-based workflow fallback and legacy request-shape compatibility
- Updated `src/app/dashboard/cases/[caseId]/page.tsx` to send `{ workflowKey }` via `buildProcessRequestBody(...)`
  - preserves `preauth` and `discharge` selections by using `pres.targetWorkflowKey`
  - stops the client from posting a legacy `action` field

## Verification

- Focused red:
  - `npm test -- src/lib/yoxa/process-request.test.ts`
  - Failed because `src/lib/yoxa/process-request.ts` did not exist yet
- Focused green:
  - `npm test -- src/lib/yoxa/process-request.test.ts`
  - Passed: `1` file, `14` tests

## Notes / concerns

- `npx tsc --noEmit` still fails on unrelated pre-existing missing modules:
  - `src/lib/cases/aggregate.test.ts` -> `./aggregate`
  - `src/lib/dashboard/metrics.test.ts` -> `./metrics`
- `npx eslint ...page.tsx` reports pre-existing issues in `src/app/dashboard/cases/[caseId]/page.tsx` unrelated to this request-body contract change (existing `any` usage / hook ordering warnings). Task 2 changes were kept narrow per brief.
