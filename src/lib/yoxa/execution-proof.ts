import type { WorkflowRunRow } from "@/lib/cases/contracts";
import type { WorkflowRunRecord, WorkflowRunStatus } from "./types";

export type ExecutionProofState =
  | "resume-tracking"
  | "completed"
  | "failed"
  | "queued"
  | "triggering"
  | "running"
  | "waiting-for-human"
  | "cancelled";

export interface ExecutionProof {
  state: ExecutionProofState;
  durableRun: {
    workflowRunId: string;
    idempotencyKey: string;
    persistedAt: string;
    queuedAt: string | null;
  };
  requestDispatch: {
    dispatched: boolean;
    dispatchedAt: string | null;
  };
  acceptedResponse: {
    accepted: boolean;
    upstreamStatusCode: number | null;
    yoxaExecutionId: string | null;
  };
  currentRun: {
    status: WorkflowRunStatus;
    terminal: boolean;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    updatedAt: string;
  };
}

interface ExecutionProofOptions {
  source?: "persisted-run" | "existing-active-run";
}

type PersistedWorkflowRun = Pick<
  WorkflowRunRow,
  | "id"
  | "idempotency_key"
  | "status"
  | "yoxa_execution_id"
  | "raw_response"
  | "queued_at"
  | "started_at"
  | "completed_at"
  | "failed_at"
  | "created_at"
  | "updated_at"
> &
  Pick<WorkflowRunRecord, never>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPersistedResponseBody(rawResponse: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!isRecord(rawResponse)) {
    return null;
  }

  if (isRecord(rawResponse.body)) {
    return rawResponse.body;
  }

  return rawResponse;
}

function readUpstreamStatusCode(rawResponse: Record<string, unknown> | null): number | null {
  if (!isRecord(rawResponse)) {
    return null;
  }

  if (typeof rawResponse.statusCode === "number") {
    return rawResponse.statusCode;
  }

  if (typeof rawResponse.status === "number") {
    return rawResponse.status;
  }

  return null;
}

function readExecutionId(
  run: Pick<PersistedWorkflowRun, "yoxa_execution_id" | "raw_response">
): string | null {
  if (run.yoxa_execution_id) {
    return run.yoxa_execution_id;
  }

  const body = readPersistedResponseBody(run.raw_response);
  if (body && typeof body.workflow_run_id === "string") {
    return body.workflow_run_id;
  }

  if (run.raw_response && typeof run.raw_response.workflow_run_id === "string") {
    return run.raw_response.workflow_run_id;
  }

  return null;
}

function normalizeState(
  run: Pick<PersistedWorkflowRun, "status" | "raw_response">,
  options: ExecutionProofOptions
): ExecutionProofState {
  if (options.source === "existing-active-run") {
    return "resume-tracking";
  }

  if (run.status === "COMPLETED") {
    return "completed";
  }

  if (run.status === "FAILED") {
    return "failed";
  }

  switch (run.status) {
    case "QUEUED":
      return "queued";
    case "TRIGGERING":
      return "triggering";
    case "RUNNING":
      return "running";
    case "WAITING_FOR_HUMAN":
      return "waiting-for-human";
    case "CANCELLED":
      return "cancelled";
    default:
      return "queued";
  }
}

function isTerminalStatus(status: WorkflowRunStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
}

export function buildExecutionProof(
  run: PersistedWorkflowRun,
  options: ExecutionProofOptions = {}
): ExecutionProof {
  const upstreamStatusCode = readUpstreamStatusCode(run.raw_response);

  return {
    state: normalizeState(run, options),
    durableRun: {
      workflowRunId: run.id,
      idempotencyKey: run.idempotency_key,
      persistedAt: run.created_at,
      queuedAt: run.queued_at,
    },
    requestDispatch: {
      dispatched: run.started_at !== null,
      dispatchedAt: run.started_at,
    },
    acceptedResponse: {
      accepted: upstreamStatusCode === 202,
      upstreamStatusCode,
      yoxaExecutionId: readExecutionId(run),
    },
    currentRun: {
      status: run.status,
      terminal: isTerminalStatus(run.status),
      startedAt: run.started_at,
      completedAt: run.completed_at,
      failedAt: run.failed_at,
      updatedAt: run.updated_at,
    },
  };
}
