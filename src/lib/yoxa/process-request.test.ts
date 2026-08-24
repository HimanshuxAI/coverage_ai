import { describe, expect, it } from "vitest";

import { getStatusPresentation } from "@/lib/workflow/presentation";
import type { YoxaWorkflowKey } from "@/lib/yoxa/types";

import {
  buildProcessRequestBody,
  canRenderProcessAction,
  parseProcessRequest,
} from "./process-request";

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
