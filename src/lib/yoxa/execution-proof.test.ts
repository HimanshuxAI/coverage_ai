import { describe, expect, it } from "vitest";

import type { WorkflowRunRow } from "@/lib/cases/contracts";

import { buildExecutionProof } from "./execution-proof";

function buildWorkflowRunRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run-accepted-1",
    case_id: "CASE-CT-REAL-001",
    workflow_key: "preauth",
    workflow_name: "Pre-auth",
    yoxa_execution_id: "yoxa-run-1",
    idempotency_key: "idem-1",
    status: "RUNNING",
    attempt: 1,
    input_payload: { workflowKey: "preauth" },
    raw_response: {
      statusCode: 202,
      body: {
        workflow_run_id: "yoxa-run-1",
        accepted: true,
      },
    },
    normalized_output: {
      triggered: true,
      statusCode: 202,
    },
    error_code: null,
    error_message: null,
    queued_at: "2026-08-24T10:30:00.000Z",
    started_at: "2026-08-24T10:31:00.000Z",
    completed_at: null,
    failed_at: null,
    created_at: "2026-08-24T10:30:00.000Z",
    updated_at: "2026-08-24T10:32:00.000Z",
    ...overrides,
  };
}

describe("buildExecutionProof", () => {
  it("maps an accepted 202 trigger to accepted proof instead of completed proof", () => {
    const proof = buildExecutionProof(buildWorkflowRunRow());

    expect(proof).toMatchObject({
      state: "accepted",
      durableRun: {
        workflowRunId: "run-accepted-1",
        idempotencyKey: "idem-1",
        persistedAt: "2026-08-24T10:30:00.000Z",
      },
      requestDispatch: {
        dispatched: true,
        dispatchedAt: "2026-08-24T10:31:00.000Z",
      },
      acceptedResponse: {
        upstreamStatusCode: 202,
        accepted: true,
        yoxaExecutionId: "yoxa-run-1",
      },
      currentRun: {
        status: "RUNNING",
        terminal: false,
      },
    });
    expect(proof.currentRun.completedAt).toBeNull();
  });

  it("keeps the execution id absent when the persisted accepted response never recorded one", () => {
    const proof = buildExecutionProof(
      buildWorkflowRunRow({
        yoxa_execution_id: null,
        raw_response: {
          statusCode: 202,
          body: {
            accepted: true,
          },
        },
      })
    );

    expect(proof).toMatchObject({
      state: "accepted",
      acceptedResponse: {
        upstreamStatusCode: 202,
        accepted: true,
        yoxaExecutionId: null,
      },
    });
  });

  it("marks an existing active run as resume-tracking proof", () => {
    const proof = buildExecutionProof(buildWorkflowRunRow(), {
      source: "existing-active-run",
    });

    expect(proof).toMatchObject({
      state: "resume-tracking",
      durableRun: {
        workflowRunId: "run-accepted-1",
      },
      currentRun: {
        status: "RUNNING",
        terminal: false,
      },
    });
  });
});
