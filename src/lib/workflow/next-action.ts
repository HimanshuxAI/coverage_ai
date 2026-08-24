import type { YoxaWorkflowKey } from "@/lib/yoxa/types";

export interface NextActionResolutionGraph {
  graphState: string;
}

export interface NextActionContext {
  caseStatus: string;
  resolutionGraph: NextActionResolutionGraph | null;
}

interface InvalidNextWorkflowError {
  code: "INVALID_NEXT_WORKFLOW";
  message: string;
  requestedWorkflowKey: YoxaWorkflowKey;
  nextWorkflowKey: YoxaWorkflowKey | null;
  caseStatus: string;
  resolutionGraphState: string | null;
}

export type NextWorkflowAssertionResult =
  | {
      ok: true;
      workflowKey: YoxaWorkflowKey;
    }
  | {
      ok: false;
      error: InvalidNextWorkflowError;
    };

export function caseStatusRequiresResolutionGraph(caseStatus: string): boolean {
  return caseStatus === "WAITING_FOR_EVIDENCE";
}

function isMaterialChangeGraphState(graphState: string | null): boolean {
  return graphState === "HUMAN_AMBIGUITY" || graphState === "RESOLVABLE_MISSING_EVIDENCE";
}

export function getNextWorkflowKey(
  caseStatus: string,
  resolutionGraph: NextActionResolutionGraph | null
): YoxaWorkflowKey | null {
  const graphState = resolutionGraph?.graphState ?? null;

  switch (caseStatus) {
    case "WAITING_FOR_ACTIVATION":
      return "intake";
    case "ACTIVATED_VALIDATED":
    case "EVIDENCE_RESOLVED":
    case "DECISION_READY":
      return "preauth";
    case "WAITING_FOR_EVIDENCE":
      return isMaterialChangeGraphState(graphState) ? "materialChange" : "preauth";
    case "HUMAN_AMBIGUITY":
    case "CLARIFICATION_REQUESTED":
      return "materialChange";
    case "AUTHORISED_BY_HUMAN":
    case "DISCHARGE_PENDING":
      return "discharge";
    case "SETTLEMENT_PENDING":
      return "settlement";
    case "DECLINED_OR_REDUCED_BY_HUMAN":
    case "APPEAL_OPEN":
      return "appeal";
    case "HUMAN_REVIEW_REQUIRED":
    case "TOOL_FAILURE":
    case "FAILED":
    default:
      return null;
  }
}

export function assertRequestedWorkflowIsNext(
  requestedWorkflowKey: YoxaWorkflowKey,
  context: NextActionContext
): NextWorkflowAssertionResult {
  const nextWorkflowKey = getNextWorkflowKey(context.caseStatus, context.resolutionGraph);

  if (requestedWorkflowKey === nextWorkflowKey) {
    return {
      ok: true,
      workflowKey: requestedWorkflowKey,
    };
  }

  const resolutionGraphState = context.resolutionGraph?.graphState ?? null;
  const expectedText = nextWorkflowKey === null ? "no workflow" : `"${nextWorkflowKey}"`;

  return {
    ok: false,
    error: {
      code: "INVALID_NEXT_WORKFLOW",
      message: `Requested workflow "${requestedWorkflowKey}" is not the next valid action for case status "${context.caseStatus}". Expected ${expectedText}.`,
      requestedWorkflowKey,
      nextWorkflowKey,
      caseStatus: context.caseStatus,
      resolutionGraphState,
    },
  };
}
