/* ======================================================
   COVERAGE TWIN — Status & Presentation Mapper
   Centralized status presentation system for Operations Dashboard & Command Center.
   ====================================================== */

import { getNextWorkflowKey, type NextActionResolutionGraph } from "./next-action";

export interface StatusPresentation {
  label: string;
  tone: "lime" | "green" | "forest" | "amber" | "red" | "muted";
  badgeBg: string;
  badgeText: string;
  description: string;
  nextActionLabel: string | null;
  targetWorkflowKey: "intake" | "preauth" | "materialChange" | "discharge" | "settlement" | "appeal" | null;
}

export function getStatusPresentation(
  status: string,
  resolutionGraph: NextActionResolutionGraph | null = null
): StatusPresentation {
  const targetWorkflowKey = getNextWorkflowKey(status, resolutionGraph);

  switch (status) {
    case "WAITING_FOR_ACTIVATION":
      return {
        label: "WAITING FOR ACTIVATION",
        tone: "muted",
        badgeBg: "#DCE2DD",
        badgeText: "#063B22",
        description: "Case submitted and awaiting intake normalisation.",
        nextActionLabel: "START INTAKE",
        targetWorkflowKey,
      };
    case "ACTIVATED_VALIDATED":
      return {
        label: "ACTIVATED & VALIDATED",
        tone: "green",
        badgeBg: "#20C878",
        badgeText: "#07130C",
        description: "Member & policy verified. Ready for pre-authorisation.",
        nextActionLabel: "RUN PRE-AUTH",
        targetWorkflowKey,
      };
    case "WAITING_FOR_EVIDENCE":
    case "EVIDENCE_RESOLVED":
      return {
        label: "RESOLVING EVIDENCE",
        tone: "forest",
        badgeBg: "#063B22",
        badgeText: "#C7F36B",
        description: "Clinical and hospital evidence being synthesized.",
        nextActionLabel: targetWorkflowKey === "materialChange" ? "RE-EVALUATE CASE" : "RUN PRE-AUTH",
        targetWorkflowKey,
      };
    case "DECISION_READY":
      return {
        label: "DECISION READY",
        tone: "lime",
        badgeBg: "#C7F36B",
        badgeText: "#063B22",
        description: "Policy, clinical & financial evidence aligned for human decision.",
        nextActionLabel: "GENERATE DECISION PACKET",
        targetWorkflowKey,
      };
    case "HUMAN_REVIEW_REQUIRED":
      return {
        label: "HUMAN REVIEW REQUIRED",
        tone: "amber",
        badgeBg: "#D99A2B",
        badgeText: "#07130C",
        description: "Approval node active. Managed natively in Yoxa modal.",
        nextActionLabel: "OPEN YOXA REVIEW",
        targetWorkflowKey,
      };
    case "HUMAN_AMBIGUITY":
      return {
        label: "HUMAN AMBIGUITY",
        tone: "amber",
        badgeBg: "#D99A2B",
        badgeText: "#07130C",
        description: "Material fact ambiguity detected during re-evaluation.",
        nextActionLabel: "RE-EVALUATE CASE",
        targetWorkflowKey,
      };
    case "AUTHORISED_BY_HUMAN":
      return {
        label: "AUTHORISED",
        tone: "lime",
        badgeBg: "#C7F36B",
        badgeText: "#063B22",
        description: "Authorised by human reviewer. Durable decision packet created.",
        nextActionLabel: "PROCESS DISCHARGE",
        targetWorkflowKey,
      };
    case "CLARIFICATION_REQUESTED":
      return {
        label: "CLARIFICATION REQUESTED",
        tone: "amber",
        badgeBg: "#D99A2B",
        badgeText: "#07130C",
        description: "Additional clinical facts requested from hospital.",
        nextActionLabel: "SUBMIT CLARIFICATION",
        targetWorkflowKey,
      };
    case "DECLINED_OR_REDUCED_BY_HUMAN":
      return {
        label: "DECLINED / REDUCED",
        tone: "red",
        badgeBg: "#D94A4A",
        badgeText: "#FFFFFF",
        description: "Pre-authorisation declined or benefit reduced by human reviewer.",
        nextActionLabel: "FILE APPEAL",
        targetWorkflowKey,
      };
    case "DISCHARGE_PENDING":
      return {
        label: "DISCHARGE PENDING",
        tone: "forest",
        badgeBg: "#063B22",
        badgeText: "#C7F36B",
        description: "Collecting outcome evidence and discharge facts.",
        nextActionLabel: "PROCESS DISCHARGE",
        targetWorkflowKey,
      };
    case "SETTLEMENT_PENDING":
      return {
        label: "SETTLEMENT PENDING",
        tone: "green",
        badgeBg: "#20C878",
        badgeText: "#07130C",
        description: "Reconciling final hospital bill against pre-auth authorization.",
        nextActionLabel: "SETTLE BILL",
        targetWorkflowKey,
      };
    case "APPEAL_OPEN":
      return {
        label: "APPEAL OPEN",
        tone: "amber",
        badgeBg: "#D99A2B",
        badgeText: "#07130C",
        description: "Dispute opened. Re-evaluating against audit trail.",
        nextActionLabel: "RESOLVE APPEAL",
        targetWorkflowKey,
      };
    case "TOOL_FAILURE":
    case "FAILED":
      return {
        label: "ATTENTION REQUIRED",
        tone: "red",
        badgeBg: "#D94A4A",
        badgeText: "#FFFFFF",
        description: "Workflow execution failed or encountered exception.",
        nextActionLabel: "RETRY WORKFLOW",
        targetWorkflowKey,
      };
    default:
      return {
        label: status.toUpperCase().replace(/_/g, " "),
        tone: "muted",
        badgeBg: "#DCE2DD",
        badgeText: "#07130C",
        description: "Case status currently processing.",
        nextActionLabel: null,
        targetWorkflowKey,
      };
  }
}

// Centralized Demo Presentation Metadata (for UI presentation fallback)
export const demoPresentationData = {
  defaultProcedure: "Laparoscopic Cholecystectomy",
  defaultDiagnosis: "Calculus of gallbladder w/ acute cholecystitis (ICD-10 K80.1)",
  defaultRequestedAmount: "₹85,000",
  defaultAdmissibleAmount: "₹85,000",
  defaultEvidenceCompleteness: "98%",
  defaultCoverageConfidence: "96%",
  defaultMemberName: "MEM-CT-1001",
  defaultPolicyId: "CT-HEALTH-2026-001",
  defaultHospitalId: "HSP-NIR-021 (Tier-1 Network Hospital)",
};
