# Phase C Contract Evidence

Scope for this note is local verification only. I did not trigger live Yoxa, did not deploy, and did not change product source code.

## Verification commands

- `npm run test -- src/lib/workflow/next-action.test.ts src/lib/yoxa/process-request.test.ts src/lib/yoxa/process-request.boundary.test.ts src/app/api/cases/[caseId]/process/route.test.ts src/lib/yoxa/execution-proof.test.ts src/app/api/cases/[caseId]/route.test.ts src/lib/cases/active-refresh.test.ts src/lib/yoxa/runs.test.ts src/lib/cases/command-center.test.ts src/lib/cases/aggregate.test.ts`
  - Result: `10 passed`, `92 tests passed`
- `npm run test`
  - Result: `13 passed`, `107 tests passed`
- `npm run lint`
  - Result: passed
- `npm run build`
  - Result: passed

## Verified local process contract

The process endpoint rejects malformed, missing, or invalid workflow keys before orchestration boundaries:

- HTTP `400`
- `success: false`
- `error.code: "INVALID_WORKFLOW_KEY"`
- no call to `createClient`
- no call to `getOrCreateWorkflowRun`
- no call to `updateWorkflowRunState`
- no call to `triggerYoxaWorkflow`

The process endpoint also rejects a valid-but-not-next workflow key before workflow-run persistence:

- HTTP `409`
- `success: false`
- `error.code: "INVALID_NEXT_WORKFLOW"`
- response includes `requestedWorkflowKey`, `nextWorkflowKey`, `caseStatus`, and `resolutionGraphState`
- no call to `getOrCreateWorkflowRun`
- no call to `updateWorkflowRunState`
- no call to `triggerYoxaWorkflow`

The local acceptance path is truthful about accepted upstream responses:

- local HTTP status can be `202` after durable persistence and an accepted upstream trigger
- `executionProof.state` remains `running`
- `acceptedResponse.accepted` is `true`
- `acceptedResponse.upstreamStatusCode` is `202`
- `currentRun.status` is `RUNNING`
- `currentRun.terminal` is `false`
- `requestDispatch.dispatched` is `true`

The existing-active-run path returns resume-tracking proof rather than starting a second trigger:

- local HTTP status is `200`
- message is `Existing active workflow run already in progress`
- `executionProof.state` is `resume-tracking`
- `acceptedResponse.accepted` is `true`
- `acceptedResponse.upstreamStatusCode` is `202`
- `currentRun.status` is `RUNNING`
- `currentRun.terminal` is `false`

### Exact response skeletons

Fresh accepted path (`HTTP 202`):

```json
{
  "success": true,
  "data": {
    "caseId": "case-123",
    "status": "AUTHORISED_BY_HUMAN",
    "workflowRun": {
      "id": "run-accepted-1",
      "case_id": "case-123",
      "workflow_key": "discharge",
      "workflow_name": "Discharge",
      "yoxa_execution_id": null,
      "idempotency_key": "wf_discharge_case-123_1",
      "status": "RUNNING",
      "attempt": 1,
      "input_payload": { "triggered_by": "api" },
      "raw_response": {
        "statusCode": 202,
        "body": { "accepted": true },
        "rawBody": "{\"accepted\":true}"
      },
      "normalized_output": {
        "triggered": true,
        "statusCode": 202,
        "timestamp": "<iso timestamp>"
      },
      "error_code": null,
      "error_message": null,
      "queued_at": "2026-08-24T11:00:00.000Z",
      "started_at": "2026-08-24T11:00:05.000Z",
      "completed_at": null,
      "failed_at": null,
      "created_at": "2026-08-24T11:00:00.000Z",
      "updated_at": "2026-08-24T11:00:05.000Z"
    },
    "executionProof": {
      "state": "running",
      "durableRun": {
        "workflowRunId": "run-accepted-1",
        "idempotencyKey": "wf_discharge_case-123_1",
        "persistedAt": "2026-08-24T11:00:00.000Z",
        "queuedAt": "2026-08-24T11:00:00.000Z"
      },
      "requestDispatch": {
        "dispatched": true,
        "dispatchedAt": "2026-08-24T11:00:05.000Z"
      },
      "acceptedResponse": {
        "accepted": true,
        "upstreamStatusCode": 202,
        "yoxaExecutionId": null
      },
      "currentRun": {
        "status": "RUNNING",
        "terminal": false,
        "startedAt": "2026-08-24T11:00:05.000Z",
        "completedAt": null,
        "failedAt": null,
        "updatedAt": "2026-08-24T11:00:05.000Z"
      }
    }
  }
}
```

Duplicate active-run path (`HTTP 200`):

```json
{
  "success": true,
  "data": {
    "caseId": "case-123",
    "status": "AUTHORISED_BY_HUMAN",
    "message": "Existing active workflow run already in progress",
    "workflowRun": {
      "id": "run-existing-1",
      "case_id": "case-123",
      "workflow_key": "discharge",
      "workflow_name": "Discharge",
      "yoxa_execution_id": "yoxa-run-123",
      "idempotency_key": "wf_discharge_case-123_1",
      "status": "RUNNING",
      "attempt": 1,
      "input_payload": { "triggered_by": "api" },
      "raw_response": {
        "statusCode": 202,
        "body": { "workflow_run_id": "yoxa-run-123" }
      },
      "normalized_output": {
        "triggered": true,
        "statusCode": 202
      },
      "error_code": null,
      "error_message": null,
      "queued_at": "2026-08-24T11:00:00.000Z",
      "started_at": "2026-08-24T11:00:05.000Z",
      "completed_at": null,
      "failed_at": null,
      "created_at": "2026-08-24T11:00:00.000Z",
      "updated_at": "2026-08-24T11:00:05.000Z"
    },
    "executionProof": {
      "state": "resume-tracking",
      "durableRun": {
        "workflowRunId": "run-existing-1",
        "idempotencyKey": "wf_discharge_case-123_1",
        "persistedAt": "2026-08-24T11:00:00.000Z",
        "queuedAt": "2026-08-24T11:00:00.000Z"
      },
      "requestDispatch": {
        "dispatched": true,
        "dispatchedAt": "2026-08-24T11:00:05.000Z"
      },
      "acceptedResponse": {
        "accepted": true,
        "upstreamStatusCode": 202,
        "yoxaExecutionId": "yoxa-run-123"
      },
      "currentRun": {
        "status": "RUNNING",
        "terminal": false,
        "startedAt": "2026-08-24T11:00:05.000Z",
        "completedAt": null,
        "failedAt": null,
        "updatedAt": "2026-08-24T11:00:05.000Z"
      }
    }
  }
}
```

## Inspector fields

Persisted source fields shown in the command-center run inspector:

- `workflowName`
- `workflowKey`
- `localRunId`
- `yoxaExecutionId`
- `idempotencyKey`
- `attempt`
- `queuedAt`
- `dispatchedAt`
- `startedAt`
- `completedAt`
- `failedAt`
- `createdAt`
- `updatedAt`

Derived display fields shown in the command-center run inspector:

- `statusLabel`
- `proofStateLabel`
- `upstreamStatusCode`
- `acceptedResponse`
- `terminalState`

The execution proof contract is derived from persisted run data only:

- `durableRun.workflowRunId`
- `durableRun.idempotencyKey`
- `durableRun.persistedAt`
- `durableRun.queuedAt`
- `requestDispatch.dispatched`
- `requestDispatch.dispatchedAt`
- `acceptedResponse.accepted`
- `acceptedResponse.upstreamStatusCode`
- `acceptedResponse.yoxaExecutionId`
- `currentRun.status`
- `currentRun.terminal`
- `currentRun.startedAt`
- `currentRun.completedAt`
- `currentRun.failedAt`
- `currentRun.updatedAt`

## Polling conditions

Active-only refresh is controlled by `createActiveRefreshController`:

- polling starts for snapshots containing any active workflow run status: `QUEUED`, `TRIGGERING`, `RUNNING`, or `WAITING_FOR_HUMAN`
- polling stops when there are no runs or when all runs are terminal
- the controller uses a `4_000 ms` interval
- it does not overlap refresh requests while one is in flight
- `stop()` aborts the in-flight request and clears scheduled work
- a refresh read failure keeps the last authoritative snapshot and marks the controller interrupted instead of mutating the run to failed

## Unmet live gates

- no safe golden case has been identified by the user
- no intended workflow key has been identified by the user
- no live Yoxa trigger was attempted
- no public HTTPS deployment target was verified
- no Yoxa webhook authentication/continuation contract was obtained
- no webhook resume endpoint has been validated
- no live acceptance/retry semantics have been proven

## Notes

- Full Phase C unit/route coverage passed locally.
- Repo-wide `npm run test`, `npm run lint`, and `npm run build` all passed.
- Build emitted non-blocking warnings about the deprecated `middleware` convention and a package-lock path outside the repository root.
