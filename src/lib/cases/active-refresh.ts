import { shouldPollWorkflowRuns } from "@/lib/yoxa/status-presentation";
import type { WorkflowRunStatus } from "@/lib/yoxa/types";

export const ACTIVE_REFRESH_INTERVAL_MS = 4_000;

interface WorkflowRunStatusCarrier {
  status: WorkflowRunStatus;
}

interface ActiveRefreshSnapshotShape {
  workflowRuns: ReadonlyArray<WorkflowRunStatusCarrier>;
}

interface ActiveRefreshControllerOptions<TSnapshot extends ActiveRefreshSnapshotShape> {
  intervalMs?: number;
  onSnapshot?: (snapshot: TSnapshot) => void;
  onInterrupted?: (error: unknown, authoritativeSnapshot: TSnapshot | null) => void;
  createAbortController?: () => AbortController;
  schedule?: typeof globalThis.setTimeout;
  cancelSchedule?: typeof globalThis.clearTimeout;
}

export interface ActiveRefreshControllerState<TSnapshot extends ActiveRefreshSnapshotShape> {
  authoritativeSnapshot: TSnapshot | null;
  interrupted: boolean;
  inFlight: boolean;
  polling: boolean;
}

export interface ActiveRefreshController<TSnapshot extends ActiveRefreshSnapshotShape> {
  start(snapshot: TSnapshot | null): void;
  update(snapshot: TSnapshot | null): void;
  stop(): void;
  getState(): ActiveRefreshControllerState<TSnapshot>;
}

export function createActiveRefreshController<TSnapshot extends ActiveRefreshSnapshotShape>(
  fetchAggregate: (signal: AbortSignal) => Promise<TSnapshot>,
  options: ActiveRefreshControllerOptions<TSnapshot> = {}
): ActiveRefreshController<TSnapshot> {
  const intervalMs = options.intervalMs ?? ACTIVE_REFRESH_INTERVAL_MS;
  const schedule = options.schedule ?? globalThis.setTimeout;
  const cancelSchedule = options.cancelSchedule ?? globalThis.clearTimeout;
  const createAbortController = options.createAbortController ?? (() => new AbortController());

  let started = false;
  let authoritativeSnapshot: TSnapshot | null = null;
  let interrupted = false;
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let inFlightController: AbortController | null = null;

  function hasActiveSnapshot(snapshot: TSnapshot | null): boolean {
    return snapshot !== null && shouldPollWorkflowRuns(snapshot.workflowRuns);
  }

  function isPollingActive() {
    return started && hasActiveSnapshot(authoritativeSnapshot);
  }

  function clearTimer() {
    if (timer === null) {
      return;
    }

    cancelSchedule(timer);
    timer = null;
  }

  function abortInFlight() {
    if (inFlightController === null) {
      return;
    }

    inFlightController.abort();
    inFlightController = null;
  }

  function scheduleNextRefresh() {
    if (!isPollingActive() || timer !== null || inFlightController !== null) {
      return;
    }

    timer = schedule(() => {
      timer = null;
      void runRefresh();
    }, intervalMs);
  }

  async function runRefresh() {
    if (!isPollingActive() || inFlightController !== null) {
      return;
    }

    const controller = createAbortController();
    inFlightController = controller;

    try {
      const nextSnapshot = await fetchAggregate(controller.signal);
      if (!started || controller.signal.aborted) {
        return;
      }

      authoritativeSnapshot = nextSnapshot;
      interrupted = false;
      options.onSnapshot?.(nextSnapshot);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      interrupted = true;
      options.onInterrupted?.(error, authoritativeSnapshot);
    } finally {
      if (inFlightController === controller) {
        inFlightController = null;
      }

      scheduleNextRefresh();
    }
  }

  function syncSnapshot(snapshot: TSnapshot | null) {
    authoritativeSnapshot = snapshot;
    interrupted = false;

    if (!hasActiveSnapshot(snapshot)) {
      clearTimer();
      abortInFlight();
      return;
    }

    scheduleNextRefresh();
  }

  return {
    start(snapshot) {
      started = true;
      syncSnapshot(snapshot);
    },
    update(snapshot) {
      if (!started) {
        return;
      }

      syncSnapshot(snapshot);
    },
    stop() {
      started = false;
      interrupted = false;
      clearTimer();
      abortInFlight();
    },
    getState() {
      return {
        authoritativeSnapshot,
        interrupted,
        inFlight: inFlightController !== null,
        polling: isPollingActive(),
      };
    },
  };
}
