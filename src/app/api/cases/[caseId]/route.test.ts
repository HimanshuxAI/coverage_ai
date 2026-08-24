import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient,
}));

import { GET } from "./route";

function makeRequest() {
  return new NextRequest("http://localhost/api/cases/CASE-CT-REAL-001");
}

function buildCaseQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  return { select, eq, maybeSingle };
}

function buildOrderedRead(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));

  return { select, eq, order };
}

function buildUnorderedRead(result: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ eq }));

  return { select, eq };
}

function buildSupabaseClient(options?: {
  caseResult?: { data: unknown; error: unknown };
  workflowRunsResult?: { data: unknown; error: unknown };
  evidenceReportsResult?: { data: unknown; error: unknown };
  resolutionGraphsResult?: { data: unknown; error: unknown };
  humanDecisionsResult?: { data: unknown; error: unknown };
  decisionPacketsResult?: { data: unknown; error: unknown };
  auditEventsResult?: { data: unknown; error: unknown };
}) {
  const caseQuery = buildCaseQuery(options?.caseResult ?? { data: null, error: null });
  const workflowRunsQuery = buildOrderedRead(options?.workflowRunsResult ?? { data: [], error: null });
  const evidenceReportsQuery = buildUnorderedRead(options?.evidenceReportsResult ?? { data: [], error: null });
  const resolutionGraphsQuery = buildOrderedRead(options?.resolutionGraphsResult ?? { data: [], error: null });
  const humanDecisionsQuery = buildOrderedRead(options?.humanDecisionsResult ?? { data: [], error: null });
  const decisionPacketsQuery = buildOrderedRead(options?.decisionPacketsResult ?? { data: [], error: null });
  const auditEventsQuery = buildOrderedRead(options?.auditEventsResult ?? { data: [], error: null });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cases":
        return { select: caseQuery.select };
      case "workflow_runs":
        return { select: workflowRunsQuery.select };
      case "evidence_reports":
        return { select: evidenceReportsQuery.select };
      case "resolution_graphs":
        return { select: resolutionGraphsQuery.select };
      case "human_decisions":
        return { select: humanDecisionsQuery.select };
      case "decision_packets":
        return { select: decisionPacketsQuery.select };
      case "audit_events":
        return { select: auditEventsQuery.select };
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });

  return { from };
}

const caseRow = {
  id: "case-row-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  patient_consent_status: true,
  patient_consent_timestamp: "2026-08-24T10:00:00.000Z",
  hospital_clinical_confirmation_status: true,
  hospital_confirmation_timestamp: "2026-08-24T11:00:00.000Z",
  member_id: "MEM-001",
  policy_id: "POL-001",
  hospital_id: "HOSP-001",
  diagnosis: "Gallstones",
  planned_procedure: "Laparoscopic cholecystectomy",
  planned_date: "2026-08-28",
  evidence_references: ["evidence://scan-1"],
  document_provenance: "member-upload",
  current_case_status: "DECISION_READY",
  source_system: "manual-seed",
  created_at: "2026-08-24T09:00:00.000Z",
  updated_at: "2026-08-24T12:00:00.000Z",
};

describe("GET /api/cases/[caseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 CASE_READ_FAILED when the primary case query fails", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        caseResult: {
          data: null,
          error: {
            code: "57014",
            message: "canceling statement due to statement timeout",
            details: "statement timeout",
            hint: null,
          },
        },
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ caseId: "CASE-CT-REAL-001" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "CASE_READ_FAILED",
        source: "caseRecord",
        readError: {
          code: "57014",
          message: "canceling statement due to statement timeout",
          details: "statement timeout",
          hint: null,
        },
      },
    });
  });

  it("returns 404 CASE_NOT_FOUND when the primary case read returns no row", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        caseResult: {
          data: null,
          error: null,
        },
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ caseId: "CASE-CT-REAL-001" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "CASE_NOT_FOUND",
      },
    });
  });

  it("returns 502 AGGREGATE_READ_FAILED with a single failing related source", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        caseResult: { data: caseRow, error: null },
        auditEventsResult: {
          data: null,
          error: { message: "audit read exploded" },
        },
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ caseId: "CASE-CT-REAL-001" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "AGGREGATE_READ_FAILED",
        sources: ["auditEvents"],
      },
    });
  });

  it("returns 502 AGGREGATE_READ_FAILED with deterministic source ordering for multiple failures", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        caseResult: { data: caseRow, error: null },
        workflowRunsResult: {
          data: null,
          error: { message: "workflow runs down" },
        },
        decisionPacketsResult: {
          data: null,
          error: { message: "packet read down" },
        },
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ caseId: "CASE-CT-REAL-001" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "AGGREGATE_READ_FAILED",
        sources: ["workflowRuns", "decisionPackets"],
      },
    });
  });

  it("returns a success envelope with empty related reads preserved as arrays and nulls", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        caseResult: { data: caseRow, error: null },
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ caseId: "CASE-CT-REAL-001" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        case: {
          caseId: "CASE-CT-REAL-001",
        },
        workflowRuns: [],
        evidenceReports: [],
        resolutionGraph: null,
        latestDecision: null,
        latestPacket: null,
        pendingApproval: null,
        auditEvents: [],
      },
    });
  });
});
