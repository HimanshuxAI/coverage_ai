import { afterEach, describe, expect, it, vi } from "vitest";

import { getStatusPresentation } from "@/lib/workflow/presentation";
import type { YoxaWorkflowKey } from "@/lib/yoxa/types";

import {
  buildProcessRequestBody,
  canRenderProcessAction,
  parseProcessRequest,
} from "./process-request";
import type { YoxaWorkflowDefinition } from "./types";

const canonicalWorkflowKeys = [
  "intake",
  "preauth",
  "materialChange",
  "discharge",
  "settlement",
  "appeal",
] as const satisfies readonly YoxaWorkflowKey[];

const baseWorkflowDefinition = {
  key: "intake",
  name: "coverage-twin-intake-context",
  triggerUrl: "https://yoxa.example/intake/trigger",
  secret: "intake-secret",
} as const satisfies YoxaWorkflowDefinition;

function buildMockEnv(
  overrides: Partial<Record<YoxaWorkflowKey, Partial<YoxaWorkflowDefinition>>> = {}
) {
  const workflowConfigs = Object.fromEntries(
    canonicalWorkflowKeys.map((workflowKey) => [
      workflowKey,
      {
        ...baseWorkflowDefinition,
        key: workflowKey,
        name: `workflow-${workflowKey}`,
        triggerUrl: `https://yoxa.example/${workflowKey}/trigger`,
        secret: `${workflowKey}-secret`,
        ...overrides[workflowKey],
      },
    ])
  );

  return {
    env: {
      appUrl: "http://localhost:3000",
      supabase: {
        url: "https://supabase.example.co",
        publishableKey: "anon-key",
        serviceRoleKey: "",
      },
      yoxa: {
        ...workflowConfigs,
        webhookSecret: "webhook-secret",
      },
    },
  };
}

async function loadRegistryWithEnv(
  overrides: Partial<Record<YoxaWorkflowKey, Partial<YoxaWorkflowDefinition>>> = {}
) {
  vi.resetModules();
  vi.doMock("@/config/env", () => buildMockEnv(overrides));
  return import("./registry");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/config/env");
});

describe("parseProcessRequest", () => {
  it.each(canonicalWorkflowKeys)("accepts canonical workflow key %s", (workflowKey) => {
    expect(parseProcessRequest({ workflowKey })).toEqual({
      ok: true,
      workflowKey,
    });
  });

  it("rejects a missing workflow key", () => {
    const result = parseProcessRequest({});

    if (result.ok) {
      throw new Error("Expected parseProcessRequest to reject a missing workflowKey");
    }

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
    expect(result.error.message).toContain("workflowKey");
  });

  it("rejects a malformed request body", () => {
    const result = parseProcessRequest("preauth");

    if (result.ok) {
      throw new Error("Expected parseProcessRequest to reject a malformed body");
    }

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
  });

  it("rejects an invalid workflow key", () => {
    const result = parseProcessRequest({ workflowKey: "RUN PRE-AUTH" });

    if (result.ok) {
      throw new Error("Expected parseProcessRequest to reject an invalid workflowKey");
    }

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_WORKFLOW_KEY",
      },
    });
    expect(result.error.message).toContain("RUN PRE-AUTH");
  });
});

describe("buildProcessRequestBody", () => {
  it.each(canonicalWorkflowKeys)("preserves the selected workflow key %s", (workflowKey) => {
    expect(buildProcessRequestBody(workflowKey)).toEqual({
      workflowKey,
    });
  });

  it("builds the exact preauth request body for activated and validated cases", () => {
    const presentation = getStatusPresentation("ACTIVATED_VALIDATED");

    expect(buildProcessRequestBody(presentation.targetWorkflowKey!)).toEqual({
      workflowKey: "preauth",
    });
  });

  it("builds the exact discharge request body for authorised cases", () => {
    const presentation = getStatusPresentation("AUTHORISED_BY_HUMAN");

    expect(buildProcessRequestBody(presentation.targetWorkflowKey!)).toEqual({
      workflowKey: "discharge",
    });
  });
});

describe("canRenderProcessAction", () => {
  it("returns false when a status has a label but no canonical workflow key", () => {
    const presentation = getStatusPresentation("HUMAN_REVIEW_REQUIRED");

    expect(canRenderProcessAction(presentation.nextActionLabel, presentation.targetWorkflowKey)).toBe(false);
  });

  it("returns true when a status has both a label and canonical workflow key", () => {
    const presentation = getStatusPresentation("ACTIVATED_VALIDATED");

    expect(canRenderProcessAction(presentation.nextActionLabel, presentation.targetWorkflowKey)).toBe(true);
  });
});

describe("getWorkflowDefinition", () => {
  it("rejects a missing workflow secret with a machine-readable configuration error", async () => {
    const { getWorkflowDefinition } = await loadRegistryWithEnv({
      preauth: {
        secret: "",
      },
    });

    let thrown: unknown;

    try {
      getWorkflowDefinition("preauth");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: "WorkflowConfigurationError",
      code: "INVALID_WORKFLOW_CONFIGURATION",
      workflowKey: "preauth",
      field: "secret",
      reason: "missing",
    });
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("preauth");
    expect((thrown as Error).message).not.toContain("preauth-secret");
  });

  it.each([
    {
      label: "missing trigger URL",
      override: "",
      reason: "missing",
    },
    {
      label: "invalid trigger URL",
      override: "not-a-url",
      reason: "invalid_url",
    },
  ])("rejects a $label with a machine-readable configuration error", async ({ override, reason }) => {
    const { getWorkflowDefinition } = await loadRegistryWithEnv({
      discharge: {
        triggerUrl: override,
      },
    });

    let thrown: unknown;

    try {
      getWorkflowDefinition("discharge");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: "WorkflowConfigurationError",
      code: "INVALID_WORKFLOW_CONFIGURATION",
      workflowKey: "discharge",
      field: "triggerUrl",
      reason,
    });
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("discharge");
    expect((thrown as Error).message).not.toContain("not-a-url");
  });
});
