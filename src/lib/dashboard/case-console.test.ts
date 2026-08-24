import { describe, expect, it } from "vitest";

import type { CaseRecord } from "@/types/workflow";

import {
  buildDashboardCaseConsole,
  resolveSeedDemoCaseResult,
} from "./case-console";

function makeCaseRecord(
  currentCaseStatus: CaseRecord["current_case_status"],
  overrides: Partial<CaseRecord> = {}
): CaseRecord {
  return {
    id: `row-${currentCaseStatus}-${overrides.case_id ?? "1"}`,
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

describe("buildDashboardCaseConsole", () => {
  it("searches loaded case records across status, policy, procedure, and hospital fields", () => {
    const cases = [
      makeCaseRecord("WAITING_FOR_ACTIVATION", {
        case_id: "CASE-ALPHA-001",
        policy_id: "POL-ALPHA",
        hospital_id: "HOSP-WEST-9",
        planned_procedure: "Cataract surgery",
      }),
      makeCaseRecord("DECISION_READY", {
        case_id: "CASE-BETA-002",
        policy_id: "POL-BETA",
        hospital_id: "HOSP-EAST-3",
        planned_procedure: "Appendectomy",
      }),
    ];

    const consoleState = buildDashboardCaseConsole(cases, {
      searchTerm: "decision ready east",
    });

    expect(consoleState.visibleCases.map(({ case_id }) => case_id)).toEqual([
      "CASE-BETA-002",
    ]);
    expect(consoleState.filterCounts.ALL).toBe(1);
    expect(consoleState.filterCounts.DECISION_READY).toBe(1);
  });

  it("derives filter counts from persisted case statuses and applies the selected filter", () => {
    const cases = [
      makeCaseRecord("WAITING_FOR_ACTIVATION", { case_id: "CASE-ACTIVE-001" }),
      makeCaseRecord("ACTIVATED_VALIDATED", { case_id: "CASE-READY-000" }),
      makeCaseRecord("DECISION_READY", { case_id: "CASE-READY-001" }),
      makeCaseRecord("AUTHORISED_BY_HUMAN", { case_id: "CASE-AUTH-001" }),
      makeCaseRecord("TOOL_FAILURE", { case_id: "CASE-EXCEPTION-001" }),
      makeCaseRecord("DECLINED_OR_REDUCED_BY_HUMAN", { case_id: "CASE-DECLINED-001" }),
    ];

    const consoleState = buildDashboardCaseConsole(cases, {
      statusFilter: "EXCEPTION",
    });

    expect(consoleState.filterCounts).toMatchObject({
      ALL: 6,
      ACTIVE: 4,
      DECISION_READY: 2,
      AUTHORISED: 1,
      EXCEPTION: 1,
    });
    expect(consoleState.visibleCases.map(({ case_id }) => case_id)).toEqual([
      "CASE-EXCEPTION-001",
    ]);
  });

  it("keeps declined terminal decisions out of the exception bucket", () => {
    const consoleState = buildDashboardCaseConsole([
      makeCaseRecord("DECLINED_OR_REDUCED_BY_HUMAN", { case_id: "CASE-DECLINED-001" }),
      makeCaseRecord("HUMAN_AMBIGUITY", { case_id: "CASE-AMBIGUITY-001" }),
    ], {
      statusFilter: "EXCEPTION",
    });

    expect(consoleState.filterCounts.EXCEPTION).toBe(1);
    expect(consoleState.visibleCases.map(({ case_id }) => case_id)).toEqual([
      "CASE-AMBIGUITY-001",
    ]);
  });

  it("sorts cases deterministically when timestamps tie", () => {
    const cases = [
      makeCaseRecord("WAITING_FOR_ACTIVATION", {
        id: "row-zeta",
        case_id: "CASE-ZETA-002",
        updated_at: "2026-08-24T10:00:00.000Z",
      }),
      makeCaseRecord("WAITING_FOR_ACTIVATION", {
        id: "row-alpha",
        case_id: "CASE-ALPHA-001",
        updated_at: "2026-08-24T10:00:00.000Z",
      }),
      makeCaseRecord("WAITING_FOR_ACTIVATION", {
        id: "row-omega",
        case_id: "CASE-OMEGA-003",
        updated_at: "2026-08-24T11:00:00.000Z",
      }),
    ];

    const consoleState = buildDashboardCaseConsole(cases, {
      sortKey: "UPDATED_DESC",
    });

    expect(consoleState.visibleCases.map(({ case_id }) => case_id)).toEqual([
      "CASE-OMEGA-003",
      "CASE-ALPHA-001",
      "CASE-ZETA-002",
    ]);
  });
});

describe("resolveSeedDemoCaseResult", () => {
  it("returns failure feedback from a failed seed response payload", () => {
    expect(
      resolveSeedDemoCaseResult({
        ok: false,
        status: 500,
        payload: {
          success: false,
          error: "Unable to seed the demo case.",
        },
      })
    ).toEqual({
      kind: "error",
      message: "Unable to seed the demo case.",
    });
  });
});
