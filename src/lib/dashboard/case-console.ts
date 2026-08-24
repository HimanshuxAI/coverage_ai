import { getStatusPresentation } from "@/lib/workflow/presentation";
import type { CaseRecord } from "@/types/workflow";

export const DASHBOARD_STATUS_FILTERS = [
  "ALL",
  "ACTIVE",
  "DECISION_READY",
  "AUTHORISED",
  "EXCEPTION",
] as const;

export type DashboardStatusFilterKey = (typeof DASHBOARD_STATUS_FILTERS)[number];

export const DASHBOARD_SORT_KEYS = [
  "UPDATED_DESC",
  "UPDATED_ASC",
  "CASE_ID_ASC",
  "STATUS_ASC",
] as const;

export type DashboardSortKey = (typeof DASHBOARD_SORT_KEYS)[number];

export interface DashboardCaseConsoleOptions {
  searchTerm?: string;
  statusFilter?: DashboardStatusFilterKey;
  sortKey?: DashboardSortKey;
}

export interface DashboardCaseConsoleState {
  featuredCase: CaseRecord | null;
  filterCounts: Record<DashboardStatusFilterKey, number>;
  searchMatchCount: number;
  visibleCases: CaseRecord[];
}

export interface SeedDemoCaseResponseLike {
  ok: boolean;
  payload: unknown;
  status: number;
}

export interface DashboardActionFeedback {
  kind: "success" | "error";
  message: string;
}

const DECISION_READY_FILTER_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "ACTIVATED_VALIDATED",
  "DECISION_READY",
]);

const AUTHORISED_FILTER_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "AUTHORISED_BY_HUMAN",
]);

const EXCEPTION_FILTER_STATUSES = new Set<CaseRecord["current_case_status"]>([
  "HUMAN_AMBIGUITY",
  "TOOL_FAILURE",
]);

function normalizeSearchTerm(searchTerm: string): string[] {
  return searchTerm
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function getStatusFilterMatcher(statusFilter: DashboardStatusFilterKey) {
  switch (statusFilter) {
    case "ACTIVE":
      return (caseRecord: CaseRecord) =>
        !AUTHORISED_FILTER_STATUSES.has(caseRecord.current_case_status) &&
        caseRecord.current_case_status !== "DECLINED_OR_REDUCED_BY_HUMAN";
    case "DECISION_READY":
      return (caseRecord: CaseRecord) =>
        DECISION_READY_FILTER_STATUSES.has(caseRecord.current_case_status);
    case "AUTHORISED":
      return (caseRecord: CaseRecord) =>
        AUTHORISED_FILTER_STATUSES.has(caseRecord.current_case_status);
    case "EXCEPTION":
      return (caseRecord: CaseRecord) =>
        EXCEPTION_FILTER_STATUSES.has(caseRecord.current_case_status);
    case "ALL":
      return () => true;
  }
}

function buildSearchableValue(caseRecord: CaseRecord): string {
  return [
    caseRecord.case_id,
    caseRecord.member_id,
    caseRecord.policy_id,
    caseRecord.hospital_id,
    caseRecord.diagnosis,
    caseRecord.planned_procedure,
    caseRecord.current_case_status,
    getStatusPresentation(caseRecord.current_case_status).label,
  ]
    .join(" ")
    .toLowerCase();
}

function matchesSearch(caseRecord: CaseRecord, searchTokens: string[]): boolean {
  if (searchTokens.length === 0) {
    return true;
  }

  const searchableValue = buildSearchableValue(caseRecord);

  return searchTokens.every((token) => searchableValue.includes(token));
}

function getSortValue(caseRecord: CaseRecord, sortKey: DashboardSortKey): string | number {
  switch (sortKey) {
    case "UPDATED_DESC":
    case "UPDATED_ASC":
      return Date.parse(caseRecord.updated_at) || 0;
    case "CASE_ID_ASC":
      return caseRecord.case_id;
    case "STATUS_ASC":
      return getStatusPresentation(caseRecord.current_case_status).label;
  }
}

function compareCases(
  leftCase: CaseRecord,
  rightCase: CaseRecord,
  sortKey: DashboardSortKey
): number {
  const leftValue = getSortValue(leftCase, sortKey);
  const rightValue = getSortValue(rightCase, sortKey);

  switch (sortKey) {
    case "UPDATED_DESC":
      if (leftValue !== rightValue) {
        return Number(rightValue) - Number(leftValue);
      }
      break;
    case "UPDATED_ASC":
      if (leftValue !== rightValue) {
        return Number(leftValue) - Number(rightValue);
      }
      break;
    case "CASE_ID_ASC":
    case "STATUS_ASC":
      if (leftValue !== rightValue) {
        return String(leftValue).localeCompare(String(rightValue));
      }
      break;
  }

  if (leftCase.case_id !== rightCase.case_id) {
    return leftCase.case_id.localeCompare(rightCase.case_id);
  }

  return leftCase.id.localeCompare(rightCase.id);
}

function getFeaturedCase(cases: CaseRecord[]): CaseRecord | null {
  return (
    cases.find(
      (caseRecord) =>
        caseRecord.case_id.includes("REAL") || caseRecord.case_id.includes("0001")
    ) ??
    cases[0] ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildDashboardCaseConsole(
  cases: CaseRecord[],
  {
    searchTerm = "",
    statusFilter = "ALL",
    sortKey = "UPDATED_DESC",
  }: DashboardCaseConsoleOptions = {}
): DashboardCaseConsoleState {
  const searchTokens = normalizeSearchTerm(searchTerm);
  const matchingCases = cases.filter((caseRecord) => matchesSearch(caseRecord, searchTokens));

  const filterCounts = Object.fromEntries(
    DASHBOARD_STATUS_FILTERS.map((filterKey) => [
      filterKey,
      matchingCases.filter(getStatusFilterMatcher(filterKey)).length,
    ])
  ) as Record<DashboardStatusFilterKey, number>;

  const visibleCases = matchingCases
    .filter(getStatusFilterMatcher(statusFilter))
    .sort((leftCase, rightCase) => compareCases(leftCase, rightCase, sortKey));

  return {
    featuredCase: getFeaturedCase(visibleCases),
    filterCounts,
    searchMatchCount: matchingCases.length,
    visibleCases,
  };
}

export function resolveSeedDemoCaseResult({
  ok,
  payload,
  status,
}: SeedDemoCaseResponseLike): DashboardActionFeedback {
  if (ok && isRecord(payload) && payload.success === true) {
    const successMessage =
      isRecord(payload.data) && typeof payload.data.message === "string"
        ? payload.data.message
        : "Demo case seeded.";

    return {
      kind: "success",
      message: successMessage,
    };
  }

  if (isRecord(payload) && typeof payload.error === "string") {
    return {
      kind: "error",
      message: payload.error,
    };
  }

  return {
    kind: "error",
    message: `Seeding the demo case failed with status ${status}.`,
  };
}
