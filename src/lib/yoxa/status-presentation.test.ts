import { describe, expect, it } from "vitest";

import { getWorkflowStatusPresentation, shouldPollWorkflowRuns } from "./status-presentation";
import type { WorkflowRunStatus } from "./types";

describe("getWorkflowStatusPresentation", () => {
  it.each<
    [WorkflowRunStatus, { label: string; tone: string; active: boolean; terminal: boolean; shouldPoll: boolean }]
  >([
    ["QUEUED", { label: "QUEUED", tone: "muted", active: true, terminal: false, shouldPoll: true }],
    ["TRIGGERING", { label: "TRIGGERING", tone: "amber", active: true, terminal: false, shouldPoll: true }],
    ["RUNNING", { label: "RUNNING", tone: "forest", active: true, terminal: false, shouldPoll: true }],
    [
      "WAITING_FOR_HUMAN",
      { label: "WAITING FOR HUMAN", tone: "amber", active: true, terminal: false, shouldPoll: true },
    ],
    ["COMPLETED", { label: "COMPLETED", tone: "green", active: false, terminal: true, shouldPoll: false }],
    ["FAILED", { label: "FAILED", tone: "red", active: false, terminal: true, shouldPoll: false }],
    ["CANCELLED", { label: "CANCELLED", tone: "muted", active: false, terminal: true, shouldPoll: false }],
  ])("maps %s to truthful UI state", (status, expected) => {
    expect(getWorkflowStatusPresentation(status)).toEqual(expected);
  });
});

describe("shouldPollWorkflowRuns", () => {
  it("returns true when any persisted run is still active", () => {
    expect(
      shouldPollWorkflowRuns([
        { status: "COMPLETED" },
        { status: "RUNNING" },
      ])
    ).toBe(true);
  });

  it("returns false when there are no runs or only terminal runs", () => {
    expect(shouldPollWorkflowRuns([])).toBe(false);
    expect(
      shouldPollWorkflowRuns([
        { status: "COMPLETED" },
        { status: "FAILED" },
        { status: "CANCELLED" },
      ])
    ).toBe(false);
  });
});
