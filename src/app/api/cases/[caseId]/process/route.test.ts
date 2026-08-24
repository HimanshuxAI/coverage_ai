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

  const insert = vi.fn().mockResolvedValue({ data: null, error: null });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cases":
        return { select: caseSelect };
      case "resolution_graphs":
        return { select: graphSelect };
      case "audit_events":
        return { insert };
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });

  return { from, insert };
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

  it("does not read resolution_graphs for statuses whose next workflow is status-only", async () => {
    const supabaseClient = buildSupabaseClient({
      currentCaseStatus: "AUTHORISED_BY_HUMAN",
    });
    createClient.mockResolvedValue(supabaseClient);
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
    expect(supabaseClient.from).not.toHaveBeenCalledWith("resolution_graphs");
  });

  it("returns 502 RESOLUTION_GRAPH_READ_FAILED when a graph-dependent status cannot read its resolution graph", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        currentCaseStatus: "WAITING_FOR_EVIDENCE",
        resolutionGraphResult: {
          data: null,
          error: { message: "graph read down" },
        },
      })
    );

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "materialChange" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "RESOLUTION_GRAPH_READ_FAILED",
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

  it("returns local 202 Accepted with accepted proof after persistence and an accepted upstream trigger", async () => {
    const supabaseClient = buildSupabaseClient();
    createClient.mockResolvedValue(supabaseClient);
    getOrCreateWorkflowRun.mockResolvedValue({
      run: {
        id: "run-accepted-1",
        case_id: "case-123",
        workflow_key: "discharge",
        workflow_name: "Discharge",
        yoxa_execution_id: null,
        idempotency_key: "wf_discharge_case-123_1",
        status: "QUEUED",
        attempt: 1,
        input_payload: { triggered_by: "api" },
        raw_response: {},
        normalized_output: {},
        error_code: null,
        error_message: null,
        queued_at: "2026-08-24T11:00:00.000Z",
        started_at: null,
        completed_at: null,
        failed_at: null,
        created_at: "2026-08-24T11:00:00.000Z",
        updated_at: "2026-08-24T11:00:00.000Z",
      },
      isExisting: false,
    });
    updateWorkflowRunState
      .mockResolvedValueOnce({
        id: "run-accepted-1",
        status: "TRIGGERING",
      })
      .mockResolvedValueOnce({
        id: "run-accepted-1",
        case_id: "case-123",
        workflow_key: "discharge",
        workflow_name: "Discharge",
        yoxa_execution_id: null,
        idempotency_key: "wf_discharge_case-123_1",
        status: "RUNNING",
        attempt: 1,
        input_payload: { triggered_by: "api" },
        raw_response: {
          statusCode: 202,
          body: {
            accepted: true,
          },
          rawBody: "{\"accepted\":true}",
        },
        normalized_output: {
          triggered: true,
          statusCode: 202,
        },
        error_code: null,
        error_message: null,
        queued_at: "2026-08-24T11:00:00.000Z",
        started_at: "2026-08-24T11:00:05.000Z",
        completed_at: null,
        failed_at: null,
        created_at: "2026-08-24T11:00:00.000Z",
        updated_at: "2026-08-24T11:00:05.000Z",
      });
    triggerYoxaWorkflow.mockResolvedValue({
      success: true,
      statusCode: 202,
      data: {
        accepted: true,
      },
      rawBody: "{\"accepted\":true}",
    });

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "discharge" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        caseId: "case-123",
        executionProof: {
          state: "accepted",
          acceptedResponse: {
            upstreamStatusCode: 202,
            accepted: true,
            yoxaExecutionId: null,
          },
          currentRun: {
            status: "RUNNING",
          },
        },
      },
    });
    expect(updateWorkflowRunState).toHaveBeenNthCalledWith(2, "run-accepted-1", {
      status: "RUNNING",
      raw_response: {
        statusCode: 202,
        body: {
          accepted: true,
        },
        rawBody: "{\"accepted\":true}",
      },
      normalized_output: {
        triggered: true,
        statusCode: 202,
        timestamp: expect.any(String),
      },
    });
    expect(supabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_run_id: "run-accepted-1",
        event_data: expect.objectContaining({
          workflow_key: "discharge",
          workflow_run_id: "run-accepted-1",
          upstream_status: 202,
        }),
      })
    );
  });

  it("returns resume-tracking proof for an existing active workflow run", async () => {
    createClient.mockResolvedValue(buildSupabaseClient());
    getOrCreateWorkflowRun.mockResolvedValue({
      run: {
        id: "run-existing-1",
        case_id: "case-123",
        workflow_key: "discharge",
        workflow_name: "Discharge",
        yoxa_execution_id: "yoxa-run-123",
        idempotency_key: "wf_discharge_case-123_1",
        status: "RUNNING",
        attempt: 1,
        input_payload: { triggered_by: "api" },
        raw_response: {
          statusCode: 202,
          body: {
            workflow_run_id: "yoxa-run-123",
          },
        },
        normalized_output: {
          triggered: true,
          statusCode: 202,
        },
        error_code: null,
        error_message: null,
        queued_at: "2026-08-24T11:00:00.000Z",
        started_at: "2026-08-24T11:00:05.000Z",
        completed_at: null,
        failed_at: null,
        created_at: "2026-08-24T11:00:00.000Z",
        updated_at: "2026-08-24T11:00:05.000Z",
      },
      isExisting: true,
    });

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "discharge" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        message: "Existing active workflow run already in progress",
        executionProof: {
          state: "resume-tracking",
          acceptedResponse: {
            upstreamStatusCode: 202,
            accepted: true,
            yoxaExecutionId: "yoxa-run-123",
          },
          currentRun: {
            status: "RUNNING",
          },
        },
      },
    });
  });

  it("retains the upstream failure status instead of returning a synthetic 502", async () => {
    createClient.mockResolvedValue(buildSupabaseClient());
    getOrCreateWorkflowRun.mockResolvedValue({
      run: {
        id: "run-failed-1",
        case_id: "case-123",
        workflow_key: "discharge",
        workflow_name: "Discharge",
        yoxa_execution_id: null,
        idempotency_key: "wf_discharge_case-123_1",
        status: "QUEUED",
        attempt: 1,
        input_payload: { triggered_by: "api" },
        raw_response: {},
        normalized_output: {},
        error_code: null,
        error_message: null,
        queued_at: "2026-08-24T11:00:00.000Z",
        started_at: null,
        completed_at: null,
        failed_at: null,
        created_at: "2026-08-24T11:00:00.000Z",
        updated_at: "2026-08-24T11:00:00.000Z",
      },
      isExisting: false,
    });
    updateWorkflowRunState
      .mockResolvedValueOnce({
        id: "run-failed-1",
        status: "TRIGGERING",
      })
      .mockResolvedValueOnce({
        id: "run-failed-1",
        status: "FAILED",
      });
    triggerYoxaWorkflow.mockResolvedValue({
      success: false,
      statusCode: 409,
      data: {
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "payload does not match prior trigger",
        },
      },
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "payload does not match prior trigger",
        retryable: false,
      },
      rawBody: "{\"error\":{\"code\":\"IDEMPOTENCY_CONFLICT\"}}",
    });

    const response = await POST(makeRequest(JSON.stringify({ workflowKey: "discharge" })), {
      params: Promise.resolve({ caseId: "case-123" }),
    });

    expect(response.status).toBe(409);
    expect(updateWorkflowRunState).toHaveBeenNthCalledWith(2, "run-failed-1", {
      status: "FAILED",
      raw_response: {
        statusCode: 409,
        body: {
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "payload does not match prior trigger",
          },
        },
        rawBody: "{\"error\":{\"code\":\"IDEMPOTENCY_CONFLICT\"}}",
      },
      error_code: "IDEMPOTENCY_CONFLICT",
      error_message: "payload does not match prior trigger",
    });
  });
});
