import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClient,
  getOrCreateWorkflowRun,
  updateWorkflowRunState,
  triggerYoxaWorkflow,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  getOrCreateWorkflowRun: vi.fn(),
  updateWorkflowRunState: vi.fn(),
  triggerYoxaWorkflow: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient,
}));

vi.mock("@/lib/yoxa/runs", () => ({
  getOrCreateWorkflowRun,
  updateWorkflowRunState,
}));

vi.mock("@/lib/yoxa/client", () => ({
  triggerYoxaWorkflow,
}));

import { POST } from "./route";

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/cases/case-123/process", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildSupabaseClient(options?: {
  currentCaseStatus?: string;
  resolutionGraphResult?: { data: unknown; error: unknown };
}) {
  const single = vi.fn().mockResolvedValue({
    data: {
      case_id: "case-123",
      current_case_status: options?.currentCaseStatus ?? "AUTHORISED_BY_HUMAN",
      case_version: 3,
    },
    error: null,
  });
  const caseEq = vi.fn(() => ({ single }));
  const caseSelect = vi.fn(() => ({ eq: caseEq }));

  const maybeSingle = vi.fn().mockResolvedValue(options?.resolutionGraphResult ?? { data: null, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const graphEq = vi.fn(() => ({ order }));
  const graphSelect = vi.fn(() => ({ eq: graphEq }));

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cases":
        return { select: caseSelect };
      case "resolution_graphs":
        return { select: graphSelect };
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });

  return { from };
}

function expectNoSideEffects() {
  expect(createClient).not.toHaveBeenCalled();
  expect(getOrCreateWorkflowRun).not.toHaveBeenCalled();
  expect(updateWorkflowRunState).not.toHaveBeenCalled();
  expect(triggerYoxaWorkflow).not.toHaveBeenCalled();
}

describe("POST /api/cases/[caseId]/process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 INVALID_WORKFLOW_KEY for malformed JSON before orchestration boundaries", async () => {
    const response = await POST(makeRequest("{"), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
    expectNoSideEffects();
  });

  it("returns 400 INVALID_WORKFLOW_KEY for a missing workflowKey before orchestration boundaries", async () => {
    const response = await POST(makeRequest("{}"), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
    expectNoSideEffects();
  });

  it("returns 400 INVALID_WORKFLOW_KEY for an invalid workflowKey before orchestration boundaries", async () => {
    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "RUN PRE-AUTH" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
    expectNoSideEffects();
  });

  it("returns 409 INVALID_NEXT_WORKFLOW before workflow-run persistence when the requested key is valid but not next", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        currentCaseStatus: "ACTIVATED_VALIDATED",
      })
    );

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "discharge" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "INVALID_NEXT_WORKFLOW",
        requestedWorkflowKey: "discharge",
        nextWorkflowKey: "preauth",
        caseStatus: "ACTIVATED_VALIDATED",
        resolutionGraphState: null,
      },
    });
    expect(getOrCreateWorkflowRun).not.toHaveBeenCalled();
    expect(updateWorkflowRunState).not.toHaveBeenCalled();
    expect(triggerYoxaWorkflow).not.toHaveBeenCalled();
  });

  it("passes a valid workflowKey to the first orchestration boundary without triggering Yoxa", async () => {
    createClient.mockResolvedValue(buildSupabaseClient());
    getOrCreateWorkflowRun.mockResolvedValue({
      run: {
        id: "run-123",
        idempotency_key: "wf_discharge_case-123_1",
        status: "RUNNING",
      },
      isExisting: true,
    });

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "discharge" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(200);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getOrCreateWorkflowRun).toHaveBeenCalledWith("case-123", "discharge", {
      triggered_by: "api",
      case_status_at_trigger: "AUTHORISED_BY_HUMAN",
    });
    expect(updateWorkflowRunState).not.toHaveBeenCalled();
    expect(triggerYoxaWorkflow).not.toHaveBeenCalled();
  });
});
