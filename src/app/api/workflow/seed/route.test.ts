import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient,
}));

import { POST } from "./route";

function buildPromiseQuery(result: { data?: unknown; error: unknown }) {
  return {
    then(resolve: (value: { data?: unknown; error: unknown }) => unknown, reject?: (reason?: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

function buildSeedClient(options?: { existingAuditIds?: string[] }) {
  const single = vi.fn().mockResolvedValue({
    data: { case_id: "CASE-CT-0001" },
    error: null,
  });
  const selectAfterCaseUpsert = vi.fn(() => ({ single }));
  const upsert = vi.fn((rows: unknown) => {
    if (Array.isArray(rows)) {
      return buildPromiseQuery({ error: null });
    }

    if (rows && typeof rows === "object" && "case_id" in rows) {
      return { select: selectAfterCaseUpsert };
    }

    return buildPromiseQuery({ error: null });
  });

  const insert = vi.fn(() => buildPromiseQuery({ error: null }));
  const inFilter = vi.fn().mockResolvedValue({
    data: (options?.existingAuditIds ?? []).map((audit_event_id) => ({ audit_event_id })),
    error: null,
  });
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({
    upsert,
    insert,
    select,
  }));

  return { from, upsert, insert, select, inFilter, selectAfterCaseUpsert, single };
}

describe("POST /api/workflow/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts the complete demo case fixture without triggering external workflow execution", async () => {
    const supabase = buildSeedClient();
    createClient.mockResolvedValue(supabase);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        case_id: "CASE-CT-0001",
        seeded: {
          evidenceReports: 3,
          resolutionGraphs: 1,
          decisionPackets: 1,
          humanDecisions: 1,
          workflowRuns: 3,
        },
      },
    });

    expect(supabase.from).toHaveBeenCalledWith("cases");
    expect(supabase.from).toHaveBeenCalledWith("evidence_reports");
    expect(supabase.from).toHaveBeenCalledWith("resolution_graphs");
    expect(supabase.from).toHaveBeenCalledWith("decision_packets");
    expect(supabase.from).toHaveBeenCalledWith("human_decisions");
    expect(supabase.from).toHaveBeenCalledWith("workflow_runs");
    expect(supabase.from).toHaveBeenCalledWith("audit_events");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: "CASE-CT-0001",
        case_version: 2,
        current_case_status: "AUTHORISED_BY_HUMAN",
      }),
      { onConflict: "case_id" }
    );
    expect(supabase.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "case_id,case_version,agent_name",
    });
    expect(supabase.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "case_id,graph_version",
    });
    expect(supabase.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "packet_id",
    });
    expect(supabase.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "human_decision_id",
    });
    expect(supabase.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "idempotency_key",
    });
    expect(supabase.insert).toHaveBeenCalledWith(expect.any(Array));
  });

  it("does not re-insert audit events that are already present", async () => {
    const supabase = buildSeedClient({
      existingAuditIds: [
        "audit-demo-intake-normalised",
        "audit-demo-evidence-resolved",
        "audit-demo-resolution-graph-built",
        "audit-demo-human-authorised",
        "audit-demo-discharge-running",
      ],
    });
    createClient.mockResolvedValue(supabase);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
