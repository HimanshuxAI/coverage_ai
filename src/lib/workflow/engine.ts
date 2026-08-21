/* ======================================================
   YOXA — Workflow Engine
   Core state machine that orchestrates the 6-step workflow
   ====================================================== */

import type {
  CaseStatus,
  WorkflowStep,
  WorkflowStepResult,
} from "@/types/workflow";

// ─── Step Ordering ───
const STEP_ORDER: WorkflowStep[] = [
  "VALIDATE_ACTIVATION",
  "RESOLVE_EVIDENCE",
  "BUILD_RESOLUTION_GRAPH",
  "RESOLVE_BLOCKERS",
  "GENERATE_PACKET_AND_REVIEW",
  "STORE_OUTCOME",
];

const STEP_LABELS: Record<WorkflowStep, string> = {
  VALIDATE_ACTIVATION: "Validate Activated Case",
  RESOLVE_EVIDENCE: "Resolve Evidence in Parallel",
  BUILD_RESOLUTION_GRAPH: "Build Resolution Graph",
  RESOLVE_BLOCKERS: "Resolve Blockers",
  GENERATE_PACKET_AND_REVIEW: "Decision Packet & Human Review",
  STORE_OUTCOME: "Store & Communicate Outcome",
};

// ─── Map case status to the next step ───
export function getNextStep(status: CaseStatus): WorkflowStep | null {
  switch (status) {
    case "WAITING_FOR_ACTIVATION":
      return "VALIDATE_ACTIVATION";
    case "ACTIVATED_VALIDATED":
      return "RESOLVE_EVIDENCE";
    case "WAITING_FOR_EVIDENCE":
      return "RESOLVE_EVIDENCE";
    case "EVIDENCE_RESOLVED":
      return "BUILD_RESOLUTION_GRAPH";
    case "DECISION_READY":
      return "GENERATE_PACKET_AND_REVIEW";
    case "HUMAN_AMBIGUITY":
      return "RESOLVE_BLOCKERS";
    case "HUMAN_REVIEW_REQUIRED":
      return "GENERATE_PACKET_AND_REVIEW";
    case "AUTHORISED_BY_HUMAN":
    case "DECLINED_OR_REDUCED_BY_HUMAN":
      return null; // Terminal states
    case "CLARIFICATION_REQUESTED":
      return "RESOLVE_BLOCKERS";
    case "TOOL_FAILURE":
      return null;
    default:
      return null;
  }
}

// ─── Get current step index for the stepper ───
export function getCurrentStepIndex(status: CaseStatus): number {
  switch (status) {
    case "WAITING_FOR_ACTIVATION":
      return 0;
    case "ACTIVATED_VALIDATED":
      return 1;
    case "WAITING_FOR_EVIDENCE":
      return 1;
    case "EVIDENCE_RESOLVED":
      return 2;
    case "HUMAN_AMBIGUITY":
      return 3;
    case "DECISION_READY":
      return 4;
    case "HUMAN_REVIEW_REQUIRED":
      return 4;
    case "AUTHORISED_BY_HUMAN":
    case "DECLINED_OR_REDUCED_BY_HUMAN":
    case "CLARIFICATION_REQUESTED":
      return 5;
    case "TOOL_FAILURE":
      return -1;
    default:
      return 0;
  }
}

export function getStepLabel(step: WorkflowStep): string {
  return STEP_LABELS[step];
}

export function getAllSteps() {
  return STEP_ORDER.map((step, index) => ({
    step,
    label: STEP_LABELS[step],
    index,
  }));
}

// ─── Status Display Helpers ───
export function getStatusColor(status: CaseStatus): string {
  switch (status) {
    case "WAITING_FOR_ACTIVATION":
      return "var(--status-waiting)";
    case "ACTIVATED_VALIDATED":
      return "var(--status-validated)";
    case "WAITING_FOR_EVIDENCE":
      return "var(--status-evidence)";
    case "EVIDENCE_RESOLVED":
      return "var(--status-evidence)";
    case "DECISION_READY":
      return "var(--status-ready)";
    case "HUMAN_REVIEW_REQUIRED":
      return "var(--status-review)";
    case "HUMAN_AMBIGUITY":
      return "var(--status-ambiguity)";
    case "AUTHORISED_BY_HUMAN":
      return "var(--status-authorised)";
    case "CLARIFICATION_REQUESTED":
      return "var(--status-clarification)";
    case "DECLINED_OR_REDUCED_BY_HUMAN":
      return "var(--status-declined)";
    case "TOOL_FAILURE":
      return "var(--status-failure)";
    default:
      return "var(--text-muted)";
  }
}

export function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    WAITING_FOR_ACTIVATION: "Waiting for Activation",
    ACTIVATED_VALIDATED: "Activated & Validated",
    WAITING_FOR_EVIDENCE: "Resolving Evidence",
    EVIDENCE_RESOLVED: "Evidence Resolved",
    DECISION_READY: "Decision Ready",
    HUMAN_REVIEW_REQUIRED: "Human Review Required",
    HUMAN_AMBIGUITY: "Human Ambiguity",
    AUTHORISED_BY_HUMAN: "Authorised",
    CLARIFICATION_REQUESTED: "Clarification Requested",
    DECLINED_OR_REDUCED_BY_HUMAN: "Declined / Reduced",
    TOOL_FAILURE: "Tool Failure",
  };
  return labels[status] || status;
}

export { STEP_ORDER, STEP_LABELS };
