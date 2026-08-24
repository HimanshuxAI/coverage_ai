import type { WorkflowRunStatus } from "./types";

export type WorkflowStatusTone = "muted" | "amber" | "forest" | "green" | "red";

export interface WorkflowStatusPresentation {
  label: string;
  tone: WorkflowStatusTone;
  active: boolean;
  terminal: boolean;
  shouldPoll: boolean;
}

const ACTIVE_WORKFLOW_STATUSES = new Set<WorkflowRunStatus>([
  "QUEUED",
  "TRIGGERING",
  "RUNNING",
  "WAITING_FOR_HUMAN",
]);

const TERMINAL_WORKFLOW_STATUSES = new Set<WorkflowRunStatus>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

const WORKFLOW_STATUS_PRESENTATIONS: Record<WorkflowRunStatus, WorkflowStatusPresentation> = {
  QUEUED: {
    label: "QUEUED",
    tone: "muted",
    active: true,
    terminal: false,
    shouldPoll: true,
  },
  TRIGGERING: {
    label: "TRIGGERING",
    tone: "amber",
    active: true,
    terminal: false,
    shouldPoll: true,
  },
  RUNNING: {
    label: "RUNNING",
    tone: "forest",
    active: true,
    terminal: false,
    shouldPoll: true,
  },
  WAITING_FOR_HUMAN: {
    label: "WAITING FOR HUMAN",
    tone: "amber",
    active: true,
    terminal: false,
    shouldPoll: true,
  },
  COMPLETED: {
    label: "COMPLETED",
    tone: "green",
    active: false,
    terminal: true,
    shouldPoll: false,
  },
  FAILED: {
    label: "FAILED",
    tone: "red",
    active: false,
    terminal: true,
    shouldPoll: false,
  },
  CANCELLED: {
    label: "CANCELLED",
    tone: "muted",
    active: false,
    terminal: true,
    shouldPoll: false,
  },
};

export function isWorkflowRunStatus(value: unknown): value is WorkflowRunStatus {
  return typeof value === "string" && (value as WorkflowRunStatus) in WORKFLOW_STATUS_PRESENTATIONS;
}

export function getWorkflowStatusPresentation(status: WorkflowRunStatus): WorkflowStatusPresentation {
  return WORKFLOW_STATUS_PRESENTATIONS[status];
}

export function shouldPollWorkflowRuns(
  runs: ReadonlyArray<{ status: WorkflowRunStatus }>
): boolean {
  return runs.some((run) => ACTIVE_WORKFLOW_STATUSES.has(run.status));
}

export function isActiveWorkflowStatus(status: WorkflowRunStatus): boolean {
  return ACTIVE_WORKFLOW_STATUSES.has(status);
}

export function isTerminalWorkflowStatus(status: WorkflowRunStatus): boolean {
  return TERMINAL_WORKFLOW_STATUSES.has(status);
}
