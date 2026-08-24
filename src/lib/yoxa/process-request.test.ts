import { describe, expect, it } from "vitest";

import type { YoxaWorkflowKey } from "@/lib/yoxa/types";

import { buildProcessRequestBody, parseProcessRequest } from "./process-request";

const canonicalWorkflowKeys = [
  "intake",
  "preauth",
  "materialChange",
  "discharge",
  "settlement",
  "appeal",
] as const satisfies readonly YoxaWorkflowKey[];

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
});
