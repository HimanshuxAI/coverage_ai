import type { CaseRecord } from "@/types/workflow";

export const DASHBOARD_WORKFLOW_KEYS = [
  "intake",
  "preauth",
  "materialChange",
  "discharge",
  "settlement",
  "appeal",
] as const;

export type DashboardWorkflowKey = (typeof DASHBOARD_WORKFLOW_KEYS)[number];

export interface DashboardMetrics {
  activeCases: number;
  decisionReadyCases: number;
  authorisedCases: number;
  exceptionCases: number;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
  database: {
    configured: boolean;
    reachable: boolean;
  };
  workflows: Record<DashboardWorkflowKey, { configured: boolean }>;
}

const ACTIVE_EXCLUDED_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "AUTHORISED_BY_HUMAN",
  "DECLINED_OR_REDUCED_BY_HUMAN",
]);

const DECISION_READY_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "ACTIVATED_VALIDATED",
  "DECISION_READY",
]);

const EXCEPTION_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "HUMAN_AMBIGUITY",
  "TOOL_FAILURE",
]);

export function calculateDashboardMetrics(cases: CaseRecord[]): DashboardMetrics {
  return {
    activeCases: cases.filter(
      ({ current_case_status: currentCaseStatus }) => !ACTIVE_EXCLUDED_STATUSES.has(currentCaseStatus)
    ).length,
    decisionReadyCases: cases.filter(({ current_case_status: currentCaseStatus }) =>
      DECISION_READY_STATUSES.has(currentCaseStatus)
    ).length,
    authorisedCases: cases.filter(
      ({ current_case_status: currentCaseStatus }) => currentCaseStatus === "AUTHORISED_BY_HUMAN"
    ).length,
    exceptionCases: cases.filter(({ current_case_status: currentCaseStatus }) =>
      EXCEPTION_STATUSES.has(currentCaseStatus)
    ).length,
  };
}

export function formatDashboardMetricValue(value: number | null): string {
  return value === null ? "—" : value.toString().padStart(2, "0");
}
