import { describe, expect, it } from "vitest";

import {
  assertRequestedWorkflowIsNext,
  getNextWorkflowKey,
} from "./next-action";

function graphState(graphState: string) {
  return { graphState };
}

describe("getNextWorkflowKey", () => {
  it.each([
    {
      caseStatus: "WAITING_FOR_ACTIVATION",
      resolutionGraph: null,
      expected: "intake",
    },
    {
      caseStatus: "ACTIVATED_VALIDATED",
      resolutionGraph: null,
      expected: "preauth",
    },
    {
      caseStatus: "WAITING_FOR_EVIDENCE",
      resolutionGraph: graphState("RESOLVABLE_MISSING_EVIDENCE"),
      expected: "materialChange",
    },
    {
      caseStatus: "AUTHORISED_BY_HUMAN",
      resolutionGraph: null,
      expected: "discharge",
    },
    {
      caseStatus: "DECLINED_OR_REDUCED_BY_HUMAN",
      resolutionGraph: null,
      expected: "appeal",
    },
    {
      caseStatus: "SETTLEMENT_PENDING",
      resolutionGraph: null,
      expected: "settlement",
    },
    {
      caseStatus: "HUMAN_REVIEW_REQUIRED",
      resolutionGraph: null,
      expected: null,
    },
    {
      caseStatus: "TOOL_FAILURE",
      resolutionGraph: null,
      expected: null,
    },
  ])("returns $expected for $caseStatus", ({ caseStatus, resolutionGraph, expected }) => {
    expect(getNextWorkflowKey(caseStatus, resolutionGraph)).toBe(expected);
  });
});

describe("assertRequestedWorkflowIsNext", () => {
  it("rejects a valid workflow key when it is not the next server-authoritative workflow", () => {
    expect(
      assertRequestedWorkflowIsNext("discharge", {
        caseStatus: "ACTIVATED_VALIDATED",
        resolutionGraph: null,
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_NEXT_WORKFLOW",
        requestedWorkflowKey: "discharge",
        nextWorkflowKey: "preauth",
        caseStatus: "ACTIVATED_VALIDATED",
        resolutionGraphState: null,
      },
    });
  });
});
