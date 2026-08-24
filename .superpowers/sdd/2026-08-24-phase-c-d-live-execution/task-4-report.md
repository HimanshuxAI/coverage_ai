# Task 4 Report — Safe active-only aggregate refresh

Date: 2026-08-24

## Outcome

Task 4 is implemented with a pure active-refresh controller and page wiring that reuses the existing aggregate read path only.

- Added `createActiveRefreshController(fetchAggregate, options)` in `src/lib/cases/active-refresh.ts`.
- The controller schedules refreshes every `4000ms` only while persisted workflow runs are active via `shouldPollWorkflowRuns`.
- The controller guarantees one timer and one in-flight request, aborts on cleanup, and tolerates duplicate `start()` calls without accumulating StrictMode-style timers.
- The case page now uses the existing `/api/cases/[caseId]` aggregate fetch for both initial/manual refresh and active polling.
- Transient polling failures preserve the last authoritative aggregate snapshot and show `LIVE UPDATE INTERRUPTED` instead of mutating workflow runs or consulting Yoxa.
- Polling stops when no runs exist, when all runs are terminal, or when the page unmounts.

## Files changed

- `src/lib/cases/active-refresh.ts`
- `src/lib/cases/active-refresh.test.ts`
- `src/app/dashboard/cases/[caseId]/page.tsx`

## Design notes

- Kept the refresh controller pure and generic over any snapshot that exposes `workflowRuns`.
- Reused Task 3’s centralized `shouldPollWorkflowRuns` helper rather than duplicating active-status heuristics in the page.
- Reused the existing aggregate fetch and existing snapshot resolution instead of introducing a second polling architecture or any Yoxa read path.
- Preserved authoritative persisted workflow state on transient refresh errors; the page only marks the live update as interrupted and keeps rendering the last known snapshot.
- Used `AbortController` in both the initial route load and the active refresh controller so unmounts and terminal-state transitions cannot leave stale requests running.

## RED evidence

Observed before implementation:

- `src/lib/cases/active-refresh.test.ts` failed because `src/lib/cases/active-refresh.ts` did not exist.

Focused RED command:

```bash
npm test -- src/lib/cases/active-refresh.test.ts
```

Observed failure:

- `Cannot find module './active-refresh' imported from src/lib/cases/active-refresh.test.ts`

## GREEN evidence

Focused suites:

```bash
npm test -- src/lib/cases/active-refresh.test.ts src/lib/cases/command-center.test.ts src/lib/yoxa/status-presentation.test.ts
```

Result: `3` files passed, `38` tests passed.

Static verification:

```bash
npx eslint src/lib/cases/active-refresh.ts src/lib/cases/active-refresh.test.ts 'src/app/dashboard/cases/[caseId]/page.tsx'
npx tsc --noEmit
git diff --check -- src/lib/cases/active-refresh.ts src/lib/cases/active-refresh.test.ts 'src/app/dashboard/cases/[caseId]/page.tsx'
npm run build
```

Results:

- eslint: passed
- typecheck: passed
- diff check: passed
- production build: passed

## Concerns / follow-up

- `npm test` still prints the existing Vite `vite-tsconfig-paths` advisory; it did not affect results.
- `npm run build` still prints the existing Next.js middleware deprecation warning and the existing Turbopack root warning about `/Users/himanshu/package-lock.json` outside the repo.
- The page now shows `LIVE UPDATE INTERRUPTED` during transient polling failures, but there is still no separate component test for the client page itself because the repo currently verifies this flow through the pure controller tests plus type/build validation.
