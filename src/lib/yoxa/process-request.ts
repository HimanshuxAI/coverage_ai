import { YOXA_WORKFLOW_KEYS, type WorkflowRunStatus, type YoxaWorkflowKey } from "./types";

interface InvalidWorkflowKeyError {
  code: "INVALID_WORKFLOW_KEY";
  message: string;
}

export type ProcessRequestParseResult =
  | {
      ok: true;
      workflowKey: YoxaWorkflowKey;
    }
  | {
      ok: false;
      error: InvalidWorkflowKeyError;
    };

const canonicalWorkflowKeys = new Set<YoxaWorkflowKey>(YOXA_WORKFLOW_KEYS);
const activeWorkflowRunStatuses = new Set<WorkflowRunStatus>(["TRIGGERING", "RUNNING", "WAITING_FOR_HUMAN"]);

interface ProcessActionWorkflowRun {
  workflowKey: string;
  status: WorkflowRunStatus;
}

function isWorkflowKey(value: unknown): value is YoxaWorkflowKey {
  return typeof value === "string" && canonicalWorkflowKeys.has(value as YoxaWorkflowKey);
}

export function parseProcessRequest(body: unknown): ProcessRequestParseResult {
  const workflowKey =
    typeof body === "object" && body !== null && "workflowKey" in body
      ? (body as { workflowKey?: unknown }).workflowKey
      : undefined;

  if (isWorkflowKey(workflowKey)) {
    return {
      ok: true,
      workflowKey,
    };
  }

  const detail =
    workflowKey === undefined
      ? "Missing required workflowKey."
      : `Invalid workflowKey: ${JSON.stringify(workflowKey)}.`;

  return {
    ok: false,
    error: {
      code: "INVALID_WORKFLOW_KEY",
      message: `${detail} Expected one of: ${Array.from(canonicalWorkflowKeys).join(", ")}.`,
    },
  };
}

export function canRenderProcessAction(
  nextActionLabel: string | null,
  workflowKey: YoxaWorkflowKey | null,
  workflowRuns: readonly ProcessActionWorkflowRun[] = []
): boolean {
  if (typeof nextActionLabel !== "string" || nextActionLabel.length === 0 || !isWorkflowKey(workflowKey)) {
    return false;
  }

  return !workflowRuns.some(
    (workflowRun) => workflowRun.workflowKey === workflowKey && activeWorkflowRunStatuses.has(workflowRun.status)
  );
}

export function buildProcessRequestBody(workflowKey: YoxaWorkflowKey): { workflowKey: YoxaWorkflowKey } {
  return { workflowKey };
}
