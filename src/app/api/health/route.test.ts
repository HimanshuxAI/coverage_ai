import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: {
    supabase: {
      url: "https://supabase.example.co",
      publishableKey: "supabase-anon-key",
      serviceRoleKey: "",
    },
    yoxa: {
      intake: {
        triggerUrl: "https://yoxa.example/intake",
        secret: "intake-secret",
      },
      preauth: {
        triggerUrl: "https://yoxa.example/preauth",
        secret: "",
      },
      materialChange: {
        triggerUrl: "",
        secret: "material-change-secret",
      },
      discharge: {
        triggerUrl: "https://yoxa.example/discharge",
        secret: "discharge-secret",
      },
      settlement: {
        triggerUrl: "https://yoxa.example/settlement",
        secret: "settlement-secret",
      },
      appeal: {
        triggerUrl: "https://yoxa.example/appeal",
        secret: "",
      },
      webhookSecret: "webhook-secret",
    },
  },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient,
}));

import { GET } from "./route";

function buildSupabaseClient(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));

  return { from };
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports only database reachability/configuration and per-workflow configuration presence", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        data: [{ case_id: "CASE-CT-REAL-001" }],
        error: null,
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      timestamp: expect.any(String),
      database: {
        configured: true,
        reachable: true,
      },
      workflows: {
        intake: { configured: true },
        preauth: { configured: false },
        materialChange: { configured: false },
        discharge: { configured: true },
        settlement: { configured: true },
        appeal: { configured: false },
      },
    });
  });

  it("degrades database reachability without inventing broader system guarantees", async () => {
    createClient.mockResolvedValue(
      buildSupabaseClient({
        data: null,
        error: { message: "statement timeout" },
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "degraded",
      timestamp: expect.any(String),
      database: {
        configured: true,
        reachable: false,
      },
      workflows: {
        intake: { configured: true },
        preauth: { configured: false },
        materialChange: { configured: false },
        discharge: { configured: true },
        settlement: { configured: true },
        appeal: { configured: false },
      },
    });
  });
});
