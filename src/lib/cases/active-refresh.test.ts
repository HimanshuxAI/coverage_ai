import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_REFRESH_INTERVAL_MS,
  createActiveRefreshController,
} from "./active-refresh";
import type { WorkflowRunStatus } from "@/lib/yoxa/types";

interface Snapshot {
  label: string;
  workflowRuns: Array<{ status: WorkflowRunStatus }>;
}

function buildSnapshot(
  statuses: WorkflowRunStatus[],
  label: string = statuses.join("-") || "no-runs"
): Snapshot {
  return {
    label,
    workflowRuns: statuses.map((status, index) => ({
      status,
      id: `run-${index + 1}`,
    })),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe("createActiveRefreshController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each<WorkflowRunStatus>(["QUEUED", "TRIGGERING", "RUNNING", "WAITING_FOR_HUMAN"])(
    "starts polling when the persisted workflow snapshot is %s",
    async (status) => {
      const fetchAggregate = vi.fn(async () => buildSnapshot([status], `refreshed-${status}`));
      const onSnapshot = vi.fn();
      const controller = createActiveRefreshController(fetchAggregate, { onSnapshot });

      controller.start(buildSnapshot([status], `initial-${status}`));

      expect(fetchAggregate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);

      expect(fetchAggregate).toHaveBeenCalledTimes(1);
      expect(onSnapshot).toHaveBeenCalledWith(buildSnapshot([status], `refreshed-${status}`));
    }
  );

  it("stops polling when there are no runs or when runs become terminal", async () => {
    const fetchAggregate = vi.fn(async () => buildSnapshot(["RUNNING"], "unexpected"));
    const controller = createActiveRefreshController(fetchAggregate);

    controller.start(null);
    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);
    expect(fetchAggregate).not.toHaveBeenCalled();

    controller.start(buildSnapshot(["RUNNING"], "active"));
    controller.update(buildSnapshot(["COMPLETED"], "terminal"));
    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS * 2);

    expect(fetchAggregate).not.toHaveBeenCalled();
  });

  it("never overlaps refresh requests while an earlier request is still in flight", async () => {
    const deferred = createDeferred<Snapshot>();
    const fetchAggregate = vi.fn(() => deferred.promise);
    const controller = createActiveRefreshController(fetchAggregate);

    controller.start(buildSnapshot(["RUNNING"], "initial"));

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS * 2);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);

    deferred.resolve(buildSnapshot(["RUNNING"], "resolved"));
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);
    expect(fetchAggregate).toHaveBeenCalledTimes(2);
  });

  it("aborts the active request and clears scheduled work on stop", async () => {
    const deferred = createDeferred<Snapshot>();
    const signals: AbortSignal[] = [];
    const fetchAggregate = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return deferred.promise;
    });
    const controller = createActiveRefreshController(fetchAggregate);

    controller.start(buildSnapshot(["RUNNING"], "initial"));

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);
    const activeSignal = signals[0];
    if (activeSignal === undefined) {
      throw new Error("Expected polling refresh to capture an AbortSignal.");
    }
    expect(activeSignal.aborted).toBe(false);

    controller.stop();

    expect(activeSignal.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS * 2);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);
  });

  it("treats duplicate start calls as a single active scheduler", async () => {
    const fetchAggregate = vi.fn(async () => buildSnapshot(["RUNNING"], "refreshed"));
    const controller = createActiveRefreshController(fetchAggregate);

    controller.start(buildSnapshot(["RUNNING"], "initial"));
    controller.start(buildSnapshot(["RUNNING"], "strict-mode-duplicate"));

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);

    expect(fetchAggregate).toHaveBeenCalledTimes(1);
  });

  it("retains the last authoritative snapshot when a refresh read fails transiently", async () => {
    const interruption = new Error("network down");
    const fetchAggregate = vi
      .fn<(_: AbortSignal) => Promise<Snapshot>>()
      .mockRejectedValueOnce(interruption)
      .mockResolvedValueOnce(buildSnapshot(["RUNNING"], "recovered"));
    const onInterrupted = vi.fn();
    const onSnapshot = vi.fn();
    const controller = createActiveRefreshController(fetchAggregate, {
      onInterrupted,
      onSnapshot,
    });

    controller.start(buildSnapshot(["RUNNING"], "authoritative"));

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);

    expect(onInterrupted).toHaveBeenCalledWith(interruption, buildSnapshot(["RUNNING"], "authoritative"));
    expect(controller.getState()).toMatchObject({
      authoritativeSnapshot: buildSnapshot(["RUNNING"], "authoritative"),
      interrupted: true,
    });

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);

    expect(onSnapshot).toHaveBeenCalledWith(buildSnapshot(["RUNNING"], "recovered"));
    expect(controller.getState()).toMatchObject({
      authoritativeSnapshot: buildSnapshot(["RUNNING"], "recovered"),
      interrupted: false,
    });
  });

  it("stops polling after a successful refresh returns only terminal runs", async () => {
    const fetchAggregate = vi
      .fn<(_: AbortSignal) => Promise<Snapshot>>()
      .mockResolvedValueOnce(buildSnapshot(["COMPLETED"], "completed"));
    const controller = createActiveRefreshController(fetchAggregate);

    controller.start(buildSnapshot(["RUNNING"], "initial"));

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ACTIVE_REFRESH_INTERVAL_MS * 2);
    expect(fetchAggregate).toHaveBeenCalledTimes(1);
  });
});
