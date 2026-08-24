import { workflowRegistry } from "./registry";
import type { YoxaWorkflowKey } from "./types";

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

const canonicalWorkflowKeys = new Set<YoxaWorkflowKey>(
  Object.keys(workflowRegistry) as YoxaWorkflowKey[]
);

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
  workflowKey: YoxaWorkflowKey | null
): boolean {
  return typeof nextActionLabel === "string" && nextActionLabel.length > 0 && isWorkflowKey(workflowKey);
}

export function buildProcessRequestBody(workflowKey: YoxaWorkflowKey): { workflowKey: YoxaWorkflowKey } {
  return { workflowKey };
}
