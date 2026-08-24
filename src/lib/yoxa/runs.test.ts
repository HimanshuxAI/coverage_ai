import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient,
}));

import { updateWorkflowRunState } from "./runs";

function buildSupabaseUpdateClient(updatedRow: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({
    data: updatedRow,
    error: null,
  });
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));

  return {
    from,
    update,
  };
}

describe("updateWorkflowRunState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets started_at when a run first enters TRIGGERING", async () => {
    const supabase = buildSupabaseUpdateClient({
      id: "run-1",
      status: "TRIGGERING",
      started_at: "2026-08-24T10:00:00.000Z",
      updated_at: "2026-08-24T10:00:00.000Z",
      yoxa_execution_id: null,
    });
    createClient.mockResolvedValue(supabase);

    await updateWorkflowRunState("run-1", { status: "TRIGGERING" });

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "TRIGGERING",
        started_at: expect.any(String),
      })
    );
  });

  it("does not overwrite the original started_at when the same run advances from TRIGGERING to RUNNING", async () => {
    const triggeringClient = buildSupabaseUpdateClient({
      id: "run-1",
      status: "TRIGGERING",
      started_at: "2026-08-24T10:00:00.000Z",
      updated_at: "2026-08-24T10:00:00.000Z",
      yoxa_execution_id: null,
    });
    const runningClient = buildSupabaseUpdateClient({
      id: "run-1",
      status: "RUNNING",
      started_at: "2026-08-24T10:00:00.000Z",
      updated_at: "2026-08-24T10:01:00.000Z",
      yoxa_execution_id: null,
    });
    createClient.mockResolvedValueOnce(triggeringClient).mockResolvedValueOnce(runningClient);

    const triggeringRun = await updateWorkflowRunState("run-1", { status: "TRIGGERING" });
    const runningRun = await updateWorkflowRunState("run-1", { status: "RUNNING" });

    expect(triggeringClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "TRIGGERING",
        started_at: expect.any(String),
      })
    );
    expect(runningClient.update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        started_at: expect.any(String),
      })
    );
    expect(triggeringRun.started_at).toBe("2026-08-24T10:00:00.000Z");
    expect(runningRun.started_at).toBe("2026-08-24T10:00:00.000Z");
  });
});
