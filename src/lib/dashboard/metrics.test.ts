import { describe, expect, it } from "vitest";

import type { CaseRecord } from "@/types/workflow";

import {
  calculateDashboardMetrics,
  formatDashboardMetricValue,
} from "./metrics";

function makeCaseRecord(
  currentCaseStatus: CaseRecord["current_case_status"],
  overrides: Partial<CaseRecord> = {}
): CaseRecord {
  return {
    id: `row-${currentCaseStatus}`,
    case_id: `CASE-${currentCaseStatus}`,
    case_version: 1,
    patient_consent_status: true,
    patient_consent_timestamp: "2026-08-24T10:00:00.000Z",
    hospital_clinical_confirmation_status: true,
    hospital_confirmation_timestamp: "2026-08-24T10:00:00.000Z",
    member_id: "MEM-001",
    policy_id: "POL-001",
    hospital_id: "HOSP-001",
    diagnosis: "Gallstones",
    planned_procedure: "Laparoscopic cholecystectomy",
    planned_date: "2026-08-28",
    evidence_references: [],
    document_provenance: "member-upload",
    current_case_status: currentCaseStatus,
    source_system: "seed",
    created_at: "2026-08-24T09:00:00.000Z",
    updated_at: "2026-08-24T09:00:00.000Z",
    ...overrides,
  };
}

describe("calculateDashboardMetrics", () => {
  it("preserves real zero metrics instead of substituting demo counts", () => {
    expect(calculateDashboardMetrics([])).toMatchObject({
      activeCases: 0,
      decisionReadyCases: 0,
      authorisedCases: 0,
      exceptionCases: 0,
    });
  });

  it("derives metrics from real case statuses when live data exists", () => {
    const cases = [
      makeCaseRecord("WAITING_FOR_ACTIVATION"),
      makeCaseRecord("ACTIVATED_VALIDATED"),
      makeCaseRecord("DECISION_READY"),
      makeCaseRecord("AUTHORISED_BY_HUMAN"),
      makeCaseRecord("HUMAN_AMBIGUITY"),
      makeCaseRecord("DECLINED_OR_REDUCED_BY_HUMAN"),
      makeCaseRecord("TOOL_FAILURE"),
    ];

    expect(calculateDashboardMetrics(cases)).toMatchObject({
      activeCases: 5,
      decisionReadyCases: 2,
      authorisedCases: 1,
      exceptionCases: 2,
    });
  });
});

describe("formatDashboardMetricValue", () => {
  it("preserves zero values and renders unavailable metrics distinctly", () => {
    expect(formatDashboardMetricValue(0)).toBe("00");
    expect(formatDashboardMetricValue(5)).toBe("05");
    expect(formatDashboardMetricValue(null)).toBe("—");
  });
});
