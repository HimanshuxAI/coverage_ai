"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { createActiveRefreshController } from "@/lib/cases/active-refresh";
import type { CaseAggregate } from "@/lib/cases/contracts";
import {
  buildCommandCenterViewModel,
  type CommandCenterCopyField,
  type CommandCenterLoadState,
  formatCalendarDate,
  getCommandCenterCopyButtonLabel,
  getCommandCenterInspectorSelection,
  getCommandCenterManualRefreshAction,
  getCommandCenterStatusPresentation,
  getCommandCenterPacketAction,
  getCommandCenterSafeCopyFields,
  resolveCaseAggregateSnapshot,
  unwrapCaseAggregateEnvelope,
} from "@/lib/cases/command-center";
import { buildProcessRequestBody, canRenderProcessAction } from "@/lib/yoxa/process-request";
import { type WorkflowStatusTone } from "@/lib/yoxa/status-presentation";
import styles from "@/components/landing/landing.module.css";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

class CaseRequestError extends Error {
  constructor(
    readonly kind: Extract<CommandCenterLoadState, "noRecord" | "error">,
    message: string
  ) {
    super(message);
    this.name = "CaseRequestError";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "NOT RECORDED";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
}

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatCurrencyAmount(amount: number | null, currency: string | null): string {
  if (amount === null) {
    return "NO RECORD";
  }

  if (currency === "INR") {
    return `₹${amount.toLocaleString("en-IN")}`;
  }

  if (currency) {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }

  return amount.toLocaleString("en-IN");
}

function formatDecisionHeadline(decision: CaseAggregate["latestDecision"]): string {
  if (!decision) {
    return "NO DECISION RECORD";
  }

  switch (decision.outcome) {
    case "AUTHORISE":
      return `AUTHORISE ${formatCurrencyAmount(decision.authorisedAmount, decision.currency)}`;
    case "REQUEST_CLARIFICATION":
      return "REQUEST CLARIFICATION";
    case "DECLINE_OR_REDUCE":
      return decision.authorisedAmount === null
        ? "DECLINE OR REDUCE"
        : `REDUCE TO ${formatCurrencyAmount(decision.authorisedAmount, decision.currency)}`;
    default:
      return formatStatusLabel(decision.outcome);
  }
}

function getWorkflowToneColor(tone: WorkflowStatusTone): string {
  switch (tone) {
    case "green":
      return "#20C878";
    case "forest":
      return "var(--forest)";
    case "amber":
      return "#D99A2B";
    case "red":
      return "#D94A4A";
    case "muted":
      return "var(--muted)";
  }
}

function getStatusBadge(loadState: CommandCenterLoadState, caseData: CaseAggregate | null) {
  if (loadState === "stale") {
    return {
      label: "STALE SNAPSHOT",
      badgeBg: "#D99A2B",
      badgeText: "#07130C",
    };
  }

  if (caseData) {
    const presentation = getCommandCenterStatusPresentation(caseData);
    return {
      label: presentation.label,
      badgeBg: presentation.badgeBg,
      badgeText: presentation.badgeText,
    };
  }

  if (loadState === "loading") {
    return {
      label: "LOADING",
      badgeBg: "#DCE2DD",
      badgeText: "#063B22",
    };
  }

  if (loadState === "noRecord") {
    return {
      label: "NO RECORD",
      badgeBg: "#D99A2B",
      badgeText: "#07130C",
    };
  }

  return {
    label: "UNAVAILABLE",
    badgeBg: "#D94A4A",
    badgeText: "#FFFFFF",
  };
}

function getStateMessage(loadState: Exclude<CommandCenterLoadState, "ready">): string {
  switch (loadState) {
    case "loading":
      return "Loading live case aggregate…";
    case "stale":
      return "Displaying the last successful snapshot because the latest refresh failed.";
    case "noRecord":
      return "No case aggregate exists for this case ID.";
    case "error":
      return "Live case aggregate unavailable.";
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function toCaseRequestError(error: unknown): CaseRequestError {
  return error instanceof CaseRequestError
    ? error
    : new CaseRequestError("error", getErrorMessage(error));
}

async function fetchCaseAggregate(caseId: string, signal?: AbortSignal): Promise<CaseAggregate> {
  const response = await fetch(`/api/cases/${caseId}`, { signal });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.status === 404) {
    throw new CaseRequestError("noRecord", extractErrorMessage(payload) ?? `Case ${caseId} not found.`);
  }

  if (!response.ok) {
    throw new CaseRequestError(
      "error",
      extractErrorMessage(payload) ?? `Failed to load case data (${response.status}).`
    );
  }

  const aggregate = unwrapCaseAggregateEnvelope(payload);
  if (!aggregate) {
    throw new CaseRequestError("error", "Case aggregate response did not match the expected envelope.");
  }

  return aggregate;
}

export default function CaseCommandCenterPage({ params }: { params: Promise<{ caseId: string }> }) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const [caseData, setCaseData] = useState<CaseAggregate | null>(null);
  const [loadState, setLoadState] = useState<CommandCenterLoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [aggregateError, setAggregateError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [liveUpdateInterrupted, setLiveUpdateInterrupted] = useState(false);
  const [copiedFieldKey, setCopiedFieldKey] = useState<CommandCenterCopyField["key"] | null>(null);
  const caseDataRef = useRef<CaseAggregate | null>(null);
  const refreshControllerRef = useRef<ReturnType<typeof createActiveRefreshController<CaseAggregate>> | null>(
    null
  );
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  function applyCaseAggregate(nextCaseData: CaseAggregate) {
    const nextSnapshot = resolveCaseAggregateSnapshot({
      currentData: caseDataRef.current,
      nextData: nextCaseData,
    });
    caseDataRef.current = nextSnapshot.caseData;
    setCaseData(nextSnapshot.caseData);
    setSelectedWorkflowRunId((current) =>
      getCommandCenterInspectorSelection({
        currentSelectedRunId: current,
        availableRunIds: nextSnapshot.caseData?.workflowRuns.map((workflowRun) => workflowRun.id) ?? [],
      })
    );
    setLoadState(nextSnapshot.loadState);
    setAggregateError(nextSnapshot.error);
    setError(nextSnapshot.error);
    setLiveUpdateInterrupted(false);
  }

  function applyCaseRequestError(
    requestError: CaseRequestError,
    options?: {
      surfaceError?: boolean;
    }
  ) {
    const nextSnapshot = resolveCaseAggregateSnapshot({
      currentData: caseDataRef.current,
      requestError: {
        kind: requestError.kind,
        message: requestError.message,
      },
    });
    caseDataRef.current = nextSnapshot.caseData;
    setCaseData(nextSnapshot.caseData);
    setAggregateError(nextSnapshot.error);
    if (nextSnapshot.caseData === null) {
      setSelectedWorkflowRunId((current) =>
        getCommandCenterInspectorSelection({
          currentSelectedRunId: current,
          closeInspector: true,
          availableRunIds: [],
        })
      );
    }
    setLoadState(nextSnapshot.loadState);
    setError(options?.surfaceError === false ? null : nextSnapshot.error);
  }

  async function refreshCaseDetails(options?: { showLoading?: boolean }) {
    const shouldShowLoading = options?.showLoading ?? caseDataRef.current === null;
    if (shouldShowLoading) {
      setLoadState("loading");
    }

    setError(null);
    setLiveUpdateInterrupted(false);

    try {
      const nextCaseData = await fetchCaseAggregate(caseId);
      applyCaseAggregate(nextCaseData);
    } catch (requestError: unknown) {
      applyCaseRequestError(toCaseRequestError(requestError));
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadCaseDetails() {
      caseDataRef.current = null;
      setLoadState("loading");
      setAggregateError(null);
      setError(null);
      setLiveUpdateInterrupted(false);

      try {
        const nextCaseData = await fetchCaseAggregate(caseId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        applyCaseAggregate(nextCaseData);
      } catch (requestError: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        applyCaseRequestError(toCaseRequestError(requestError));
      }
    }

    void loadCaseDetails();

    return () => {
      controller.abort();
    };
  }, [caseId]);

  useEffect(() => {
    const controller = createActiveRefreshController<CaseAggregate>(
      (signal) => fetchCaseAggregate(caseId, signal),
      {
        onSnapshot: (nextCaseData) => {
          applyCaseAggregate(nextCaseData);
        },
        onInterrupted: (requestError) => {
          setLiveUpdateInterrupted(true);
          applyCaseRequestError(toCaseRequestError(requestError), { surfaceError: false });
        },
      }
    );

    refreshControllerRef.current = controller;
    controller.start(null);

    return () => {
      controller.stop();
      refreshControllerRef.current = null;
    };
  }, [caseId]);

  useEffect(() => {
    refreshControllerRef.current?.update(caseData);
  }, [caseData]);

  useEffect(() => {
    if (!selectedWorkflowRunId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedWorkflowRunId((current) =>
          getCommandCenterInspectorSelection({
            currentSelectedRunId: current,
            closeInspector: true,
            closeReason: "escape",
            availableRunIds: caseData?.workflowRuns.map((workflowRun) => workflowRun.id) ?? [],
          })
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [caseData, selectedWorkflowRunId]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const viewModel = caseData ? buildCommandCenterViewModel(caseData) : null;
  const statusBadge = getStatusBadge(loadState, caseData);
  const statusPresentation = caseData ? getCommandCenterStatusPresentation(caseData) : null;
  const selectedWorkflowRun =
    selectedWorkflowRunId && viewModel
      ? viewModel.workflow.runs.find((workflowRun) => workflowRun.id === selectedWorkflowRunId) ?? null
      : null;
  const showProcessAction =
    caseData !== null &&
    statusPresentation !== null &&
    canRenderProcessAction(statusPresentation.nextActionLabel, statusPresentation.targetWorkflowKey);
  const safeCopyFields = viewModel
    ? getCommandCenterSafeCopyFields(viewModel.caseRecord, selectedWorkflowRun)
    : [{ key: "caseId", label: "Case ID", value: caseId } satisfies CommandCenterCopyField];
  const safeCopyFieldByKey = new Map(safeCopyFields.map((field) => [field.key, field] as const));
  const packetAction = viewModel ? getCommandCenterPacketAction(viewModel.packet.record) : null;
  const workflowRunIds = viewModel?.workflow.runs.map((run) => run.id) ?? [];
  const refreshAction = getCommandCenterManualRefreshAction({
    manualRefreshing,
    aggregateError,
    liveUpdateInterrupted,
  });

  function resetCopyFeedback(fieldKey: CommandCenterCopyField["key"]) {
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
    }

    setCopiedFieldKey(fieldKey);
    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopiedFieldKey((current) => (current === fieldKey ? null : current));
      copyFeedbackTimeoutRef.current = null;
    }, 2000);
  }

  async function handleCopyField(fieldKey: CommandCenterCopyField["key"]) {
    const field = safeCopyFieldByKey.get(fieldKey);

    if (!field || !navigator.clipboard?.writeText) {
      setError("Copy is unavailable in this browser session.");
      return;
    }

    try {
      await navigator.clipboard.writeText(field.value);
      setError(null);
      resetCopyFeedback(field.key);
    } catch {
      setError("Copy failed. Please retry from a supported browser session.");
    }
  }

  async function handleManualRefresh() {
    if (manualRefreshing) {
      return;
    }

    setManualRefreshing(true);

    try {
      await refreshCaseDetails({ showLoading: caseDataRef.current === null });
    } finally {
      setManualRefreshing(false);
    }
  }

  async function handleProcessCase() {
    if (processing || caseData === null || statusPresentation === null || !statusPresentation.targetWorkflowKey) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProcessRequestBody(statusPresentation.targetWorkflowKey)),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(extractErrorMessage(payload) ?? "Failed to process case workflow step.");
      }

      await refreshCaseDetails({ showLoading: false });
    } catch (processError: unknown) {
      setError(getErrorMessage(processError));
    } finally {
      setProcessing(false);
    }
  }

  const snapshotAvailable = loadState === "ready" || loadState === "stale";
  const summaryStateMessage = loadState === "ready" ? null : getStateMessage(loadState);
  const requestedAmountText = snapshotAvailable ? "NO RECORD" : "UNAVAILABLE";
  const decisionAmountText =
    viewModel?.decision.record?.authorisedAmount === null || viewModel?.decision.record?.authorisedAmount === undefined
      ? snapshotAvailable
        ? "NO RECORD"
        : "UNAVAILABLE"
      : formatCurrencyAmount(
          viewModel.decision.record.authorisedAmount,
          viewModel.decision.record.currency
        );
  function renderCopyButton(fieldKey: CommandCenterCopyField["key"]) {
    const field = safeCopyFieldByKey.get(fieldKey);

    if (!field) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => void handleCopyField(field.key)}
        className={`${styles.commandCenterCopyButton} ${styles.commandCenterPrintHide}`}
        style={{
          marginLeft: 8,
          border: "1px solid var(--grid)",
          background: copiedFieldKey === field.key ? "var(--forest)" : "transparent",
          color: copiedFieldKey === field.key ? "var(--lime)" : "var(--forest)",
          padding: "2px 6px",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
        aria-label={`Copy ${field.label}`}
      >
        {getCommandCenterCopyButtonLabel(field.key, copiedFieldKey)}
      </button>
    );
  }

  return (
    <div className={styles.landingRoot} style={{ minHeight: "100vh" }}>
      <header className={`${styles.navShell} ${styles.commandCenterPrintHide}`}>
        <div className={styles.navLeft}>
          <Link
            href="/dashboard"
            style={{
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            ← BACK TO OPERATIONS
          </Link>
          <span style={{ color: "var(--grid)" }}>|</span>
          <span className={styles.navTitle}>CASE COMMAND CENTER</span>
        </div>

        <div className={styles.navRight}>
          <span
            style={{
              background: statusBadge.badgeBg,
              color: statusBadge.badgeText,
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderRadius: 2,
            }}
          >
            ● {statusBadge.label}
          </span>
        </div>
      </header>

      <main className={styles.commandCenterMain} style={{ padding: "40px 32px 80px", maxWidth: "1440px", margin: "0 auto" }}>
        <div className={styles.commandCenterHeader} style={{ marginBottom: 32, borderBottom: "1px solid var(--grid)", paddingBottom: 24 }}>
          <div className={styles.commandCenterHeaderRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: "var(--forest)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                CANONICAL COVERAGE CASE RECORD
              </div>
              <h1
                style={{
                  fontSize: "clamp(32px, 3.5vw, 56px)",
                  fontWeight: 300,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                {viewModel?.caseRecord.plannedProcedure ?? (summaryStateMessage ?? "CASE RECORD")}
              </h1>
              <div className={styles.commandCenterMeta} style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "13px", color: "var(--muted)", flexWrap: "wrap" }}>
                <span>
                  CASE: <strong style={{ color: "var(--ink)" }}>{caseId}</strong>
                  {renderCopyButton("caseId")}
                </span>
                <span>
                  MEMBER:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.memberId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                  {renderCopyButton("memberId")}
                </span>
                <span>
                  POLICY:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.policyId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                  {renderCopyButton("policyId")}
                </span>
                <span>
                  PROVIDER:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.hospitalId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                  {renderCopyButton("providerId")}
                </span>
              </div>
            </div>

            <div
              className={`${styles.commandCenterActions} ${styles.commandCenterPrintHide}`}
              style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={() => void handleManualRefresh()}
                disabled={manualRefreshing}
                style={{
                  border: "1px solid var(--forest)",
                  background: "transparent",
                  color: "var(--forest)",
                  padding: "10px 14px",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: manualRefreshing ? "progress" : "pointer",
                  opacity: manualRefreshing ? 0.7 : 1,
                }}
              >
                {refreshAction.label}
              </button>

              {showProcessAction && statusPresentation !== null && (
                <button
                  type="button"
                  onClick={() => void handleProcessCase()}
                  disabled={processing}
                  className={styles.btnPrimary}
                  style={{ opacity: processing ? 0.6 : 1, cursor: processing ? "not-allowed" : "pointer" }}
                >
                  {processing ? "SUBMITTING REQUEST..." : `${statusPresentation.nextActionLabel!} →`}
                </button>
              )}
            </div>
          </div>
        </div>

        {loadState === "loading" && caseData === null && (
          <div style={{ marginBottom: 24, color: "var(--muted)", fontSize: "13px" }}>Loading case details...</div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              border: "1px solid #D94A4A",
              background: "#FFF2F2",
              color: "#8E1F1F",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div
          className={styles.commandCenterMetricsGrid}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
            padding: "20px 24px",
            background: "var(--surface)",
            border: "1px solid var(--grid)",
            marginBottom: 40,
          }}
        >
          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--muted)",
                textTransform: "uppercase",
              }}
            >
              REQUESTED AMOUNT
            </span>
            <div style={{ fontSize: "28px", fontWeight: 300, color: "var(--forest)", marginTop: 2 }}>
              {requestedAmountText}
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--muted)",
                textTransform: "uppercase",
              }}
            >
              RECOMMENDED BENEFIT
            </span>
            <div style={{ fontSize: "28px", fontWeight: 300, color: "var(--forest)", marginTop: 2 }}>
              {decisionAmountText}
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--muted)",
                textTransform: "uppercase",
              }}
            >
              CURRENT STAGE
            </span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
              {statusPresentation?.label ?? (summaryStateMessage ?? "UNAVAILABLE")}
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--muted)",
                textTransform: "uppercase",
              }}
            >
              CASE VERSION
            </span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
              {viewModel ? `v${viewModel.caseRecord.caseVersion}` : snapshotAvailable ? "NO RECORD" : "UNAVAILABLE"}
            </div>
          </div>
        </div>

        <div className={styles.commandCenterPrimaryGrid} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, marginBottom: 48 }}>
          <div
            className={styles.commandCenterPanel}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--forest)",
              boxShadow: "6px 6px 0 var(--forest)",
              padding: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
                paddingBottom: 12,
                borderBottom: "1px solid var(--grid)",
              }}
            >
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  color: "var(--forest)",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                COVERAGE TWIN CANONICAL STATE
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: loadState === "ready" ? "var(--lime)" : "#07130C",
                  background: loadState === "ready" ? "var(--forest)" : "#DCE2DD",
                  padding: "4px 8px",
                }}
              >
                {loadState === "ready" ? "SYNCHRONISED" : statusBadge.label}
              </span>
            </div>

            <div className={styles.commandCenterStateGrid} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  MEMBER DOMAIN
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel?.caseRecord.memberId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? viewModel.caseRecord.patientConsentStatus
                      ? `Patient consent confirmed ${formatDateTime(viewModel.caseRecord.patientConsentTimestamp)}`
                      : "Patient consent not yet confirmed on the case record."
                    : summaryStateMessage}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  POLICY DOMAIN
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel?.caseRecord.policyId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? `Source system: ${viewModel.caseRecord.sourceSystem}`
                    : summaryStateMessage}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  CLINICAL DOMAIN
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel?.caseRecord.diagnosis ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? `Procedure: ${viewModel.caseRecord.plannedProcedure}`
                    : summaryStateMessage}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  PROVIDER DOMAIN
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel?.caseRecord.hospitalId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? viewModel.caseRecord.hospitalClinicalConfirmationStatus
                      ? `Clinical confirmation recorded ${formatDateTime(viewModel.caseRecord.hospitalConfirmationTimestamp)}`
                      : "Hospital clinical confirmation not yet recorded."
                    : summaryStateMessage}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  CASE TIMING
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel?.caseRecord.plannedDate ? formatCalendarDate(viewModel.caseRecord.plannedDate) : snapshotAvailable ? "NO RECORD" : "UNAVAILABLE"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? `Case updated ${formatDateTime(viewModel.caseRecord.updatedAt)}`
                    : summaryStateMessage}
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>
                  EVIDENCE PROVENANCE
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                  {viewModel
                    ? `${viewModel.evidence.count} persisted report${viewModel.evidence.count === 1 ? "" : "s"}`
                    : snapshotAvailable
                      ? "NO RECORD"
                      : "UNAVAILABLE"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                  {viewModel
                    ? `Case provenance: ${viewModel.evidence.provenance}`
                    : summaryStateMessage}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.commandCenterPanel} style={{ background: "var(--surface)", border: "1px solid var(--forest)", padding: 32 }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: "var(--forest)",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              AI RECOMMENDATION & DECISION BASIS
            </div>

            <div style={{ background: "var(--forest)", color: "var(--lime)", padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em" }}>PERSISTED DECISION</div>
              <div style={{ fontSize: "32px", fontWeight: 300, margin: "4px 0" }}>
                {formatDecisionHeadline(viewModel?.decision.record ?? null)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--bg)" }}>
                {viewModel?.decision.record
                  ? `${viewModel.decision.record.reviewerRole} • ${viewModel.decision.record.reviewerIdentity} • ${formatDateTime(viewModel.decision.record.decisionTimestamp)}`
                  : summaryStateMessage ?? "No persisted human decision recorded yet."}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                PERSISTED DECISION SUPPORT FACTORS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "13px" }}>
                {viewModel ? (
                  <>
                    {viewModel.resolutionGraph.availability === "unavailable" ? (
                      <div style={{ color: "#D94A4A", fontWeight: 700 }}>
                        RESOLUTION GRAPH UNAVAILABLE
                      </div>
                    ) : null}
                    {viewModel.decision.factors.length > 0 ? (
                      viewModel.decision.factors.map((factor) => (
                        <div key={factor} style={{ color: "var(--forest)", fontWeight: 600 }}>
                          {factor}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "var(--muted)" }}>
                        {viewModel.resolutionGraph.availability === "noRecord"
                          ? "No persisted resolution graph recorded yet."
                          : summaryStateMessage ?? "No persisted decision factors recorded."}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: "var(--muted)" }}>
                    {summaryStateMessage ?? "No persisted decision factors recorded."}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: 16, background: "var(--bg)", border: "1px solid var(--grid)" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 4 }}>
                HUMAN GOVERNANCE STATE
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                {viewModel?.approval.pending
                  ? `${formatStatusLabel(viewModel.approval.pending.status)} • ${viewModel.approval.pending.workflowKey.toUpperCase()}`
                  : summaryStateMessage ?? "NO PENDING APPROVAL RECORD"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                {viewModel?.approval.pending
                  ? "Pending approval is backed by the latest aggregate workflow state."
                  : viewModel?.decision.record
                    ? "No active approval remains; the latest human decision is already persisted."
                    : summaryStateMessage ?? "No pending approval row is present in the aggregate."}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.commandCenterPanel} style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32, marginBottom: 48 }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: "var(--forest)",
              textTransform: "uppercase",
              margin: "0 0 24px 0",
            }}
          >
            Yoxa Deployed Workflows Execution Trail
          </h3>

          {liveUpdateInterrupted && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                border: "1px solid #D99A2B",
                background: "#FFF7E8",
                color: "#7A5613",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              LIVE UPDATE INTERRUPTED
            </div>
          )}

          {viewModel && viewModel.workflow.runs.length > 0 ? (
            <div className={styles.commandCenterWorkflowGrid} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
              {viewModel.workflow.runs.map((workflowRun, index) => (
                <button
                  key={workflowRun.id}
                  type="button"
                  className={styles.commandCenterWorkflowCard}
                  onClick={() =>
                    setSelectedWorkflowRunId((current) =>
                      getCommandCenterInspectorSelection({
                        currentSelectedRunId: current,
                        nextSelectedRunId: workflowRun.id,
                        availableRunIds: workflowRunIds,
                      })
                    )
                  }
                  aria-pressed={selectedWorkflowRunId === workflowRun.id}
                  aria-controls={selectedWorkflowRunId === workflowRun.id ? "workflow-run-inspector" : undefined}
                  style={{
                    appearance: "none",
                    textAlign: "left",
                    background: "var(--bg)",
                    border:
                      selectedWorkflowRunId === workflowRun.id
                        ? "1px solid var(--forest)"
                        : "1px solid var(--grid)",
                    boxShadow:
                      selectedWorkflowRunId === workflowRun.id
                        ? "inset 0 0 0 1px var(--forest)"
                        : "none",
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>
                    {String(index + 1).padStart(2, "0")} WORKFLOW
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>
                    {workflowRun.workflowName}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: 6 }}>
                    {workflowRun.workflowKey.toUpperCase()}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      color: getWorkflowToneColor(workflowRun.statusPresentation.tone),
                    }}
                  >
                    ● {workflowRun.statusPresentation.label}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 6 }}>
                    Updated {formatDateTime(workflowRun.updatedAt)}
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                    {workflowRun.proofStrip.map((proofItem) => (
                      <div
                        key={`${workflowRun.id}-${proofItem.label}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          fontSize: "10px",
                          fontWeight: 700,
                          color: getWorkflowToneColor(proofItem.tone),
                          borderTop: "1px solid var(--grid)",
                          paddingTop: 6,
                        }}
                      >
                        <span>{proofItem.label}</span>
                        <span>{proofItem.value}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16, color: "var(--muted)", fontSize: "13px" }}>
              {summaryStateMessage ?? "No workflow runs recorded for this case."}
            </div>
          )}

          {selectedWorkflowRun && (
            <div
              id="workflow-run-inspector"
              role="region"
              aria-label="Technical workflow run inspection"
              className={styles.commandCenterInspector}
              style={{ marginTop: 24, padding: 20, background: "var(--bg)", border: "1px solid var(--forest)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--forest)", letterSpacing: "0.14em" }}>
                  TECHNICAL WORKFLOW RUN INSPECTION
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWorkflowRunId((current) =>
                      getCommandCenterInspectorSelection({
                        currentSelectedRunId: current,
                        closeInspector: true,
                        closeReason: "button",
                        availableRunIds: workflowRunIds,
                      })
                    )
                  }
                  aria-label="Close workflow run inspector"
                  className={styles.commandCenterPrintHide}
                  style={{
                    background: "none",
                    border: "1px solid var(--grid)",
                    cursor: "pointer",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    padding: "4px 8px",
                    textTransform: "uppercase",
                  }}
                >
                  CLOSE
                </button>
              </div>
              <div className={styles.commandCenterInspectorGrid} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 12, fontSize: "12px" }}>
                <div>
                  Workflow: <strong>{selectedWorkflowRun.inspector.workflowName}</strong>
                </div>
                <div>
                  Workflow key: <strong>{selectedWorkflowRun.inspector.workflowKey}</strong>
                </div>
                <div>
                  Status: <strong>{selectedWorkflowRun.inspector.statusLabel}</strong>
                </div>
                <div>
                  Proof state: <strong>{selectedWorkflowRun.inspector.proofStateLabel}</strong>
                </div>
                <div>
                  Local run ID: <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.inspector.localRunId}</code>
                  {renderCopyButton("localRunId")}
                </div>
                <div>
                  Yoxa run ID:{" "}
                  <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.inspector.yoxaExecutionId}</code>
                  {renderCopyButton("yoxaExecutionId")}
                </div>
                <div>
                  Idempotency key: <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.inspector.idempotencyKey}</code>
                  {renderCopyButton("idempotencyKey")}
                </div>
                <div>Attempt: <strong>{selectedWorkflowRun.inspector.attempt}</strong></div>
                <div>Terminal state: <strong>{selectedWorkflowRun.inspector.terminalState}</strong></div>
                <div>
                  Accepted response: <strong>{selectedWorkflowRun.inspector.acceptedResponse}</strong>
                </div>
                <div>
                  Upstream status: <strong>{selectedWorkflowRun.inspector.upstreamStatusCode}</strong>
                </div>
                <div>Queued: <strong>{formatDateTime(selectedWorkflowRun.inspector.queuedAt)}</strong></div>
                <div>Dispatched: <strong>{formatDateTime(selectedWorkflowRun.inspector.dispatchedAt)}</strong></div>
                <div>Started: <strong>{formatDateTime(selectedWorkflowRun.inspector.startedAt)}</strong></div>
                <div>Completed: <strong>{formatDateTime(selectedWorkflowRun.inspector.completedAt)}</strong></div>
                <div>Failed: <strong>{formatDateTime(selectedWorkflowRun.inspector.failedAt)}</strong></div>
                <div>Created: <strong>{formatDateTime(selectedWorkflowRun.inspector.createdAt)}</strong></div>
                <div>Updated: <strong>{formatDateTime(selectedWorkflowRun.inspector.updatedAt)}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.commandCenterSecondaryGrid} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32 }}>
          <div className={styles.commandCenterPanel} style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                color: "var(--forest)",
                textTransform: "uppercase",
                margin: "0 0 20px 0",
              }}
            >
              Case Operational Audit Trail
            </h3>

            <div className={styles.commandCenterAuditList} style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "13px" }}>
              {viewModel && viewModel.workflow.activity.length > 0 ? (
                viewModel.workflow.activity.map((activityItem) => (
                  <div
                    key={activityItem.id}
                    className={styles.commandCenterAuditRow}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingBottom: 8,
                      borderBottom: "1px solid var(--grid)",
                      gap: 16,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>
                      {formatDateTime(activityItem.recordedAt)} • {activityItem.eventType}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--forest)" }}>
                      {activityItem.actor}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--muted)" }}>{summaryStateMessage ?? "No audit events recorded for this case."}</div>
              )}
            </div>
          </div>

          <div className={styles.commandCenterPanel} style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                color: "var(--forest)",
                textTransform: "uppercase",
                margin: "0 0 16px 0",
              }}
            >
              Durable Decision Packet
            </h3>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              {viewModel?.packet.record?.packetId ?? (summaryStateMessage ?? "NO PACKET RECORD")}
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "8px 0 16px 0" }}>
              {viewModel?.packet.record
                ? `Generated ${formatDateTime(viewModel.packet.record.generatedAt)}`
                : summaryStateMessage ?? "No durable decision packet has been recorded for this case."}
            </p>
            {packetAction ? (
              <a
                href={packetAction.href}
                target="_blank"
                rel="noreferrer"
                className={styles.commandCenterPrintHide}
                style={{
                  display: "inline-block",
                  background: "var(--bg)",
                  border: "1px solid var(--forest)",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--forest)",
                  textDecoration: "none",
                }}
              >
                {packetAction.label}
              </a>
            ) : (
              <div
                style={{
                  display: "inline-block",
                  background: "var(--bg)",
                  border: "1px solid var(--forest)",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--forest)",
                }}
              >
                {viewModel?.packet.record
                  ? "PACKET RECORDED WITHOUT PDF"
                  : summaryStateMessage ?? "NO PACKET RECORD"}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
