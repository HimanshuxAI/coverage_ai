"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import type { CaseAggregate, WorkflowRunDto } from "@/lib/cases/contracts";
import {
  buildCommandCenterViewModel,
  type CommandCenterLoadState,
  formatCalendarDate,
  resolveCaseAggregateSnapshot,
  unwrapCaseAggregateEnvelope,
} from "@/lib/cases/command-center";
import { getStatusPresentation } from "@/lib/workflow/presentation";
import { buildProcessRequestBody, canRenderProcessAction } from "@/lib/yoxa/process-request";
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

function getWorkflowStatusColor(status: string): string {
  if (/(FAIL|ERROR|DECLINED)/i.test(status)) {
    return "#D94A4A";
  }

  if (/(COMPLETE|SUCCESS|AUTHORISED|RESOLVED)/i.test(status)) {
    return "var(--forest)";
  }

  if (/(WAITING|PENDING|HUMAN)/i.test(status)) {
    return "#D99A2B";
  }

  return "var(--muted)";
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
    const presentation = getStatusPresentation(caseData.status);
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

async function fetchCaseAggregate(caseId: string): Promise<CaseAggregate> {
  const response = await fetch(`/api/cases/${caseId}`);
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
  const [processing, setProcessing] = useState(false);
  const [selectedWorkflowRun, setSelectedWorkflowRun] = useState<WorkflowRunDto | null>(null);

  async function refreshCaseDetails(options?: { showLoading?: boolean }) {
    const shouldShowLoading = options?.showLoading ?? caseData === null;
    if (shouldShowLoading) {
      setLoadState("loading");
    }

    setError(null);

    try {
      const nextCaseData = await fetchCaseAggregate(caseId);
      const nextSnapshot = resolveCaseAggregateSnapshot({
        currentData: caseData,
        nextData: nextCaseData,
      });
      setCaseData(nextSnapshot.caseData);
      setSelectedWorkflowRun((current) =>
        current && nextSnapshot.caseData
          ? nextSnapshot.caseData.workflowRuns.find((workflowRun) => workflowRun.id === current.id) ?? null
          : null
      );
      setLoadState(nextSnapshot.loadState);
    } catch (requestError: unknown) {
      const errorState =
        requestError instanceof CaseRequestError
          ? requestError
          : new CaseRequestError("error", getErrorMessage(requestError));
      const nextSnapshot = resolveCaseAggregateSnapshot({
        currentData: caseData,
        requestError: {
          kind: errorState.kind,
          message: errorState.message,
        },
      });
      setCaseData(nextSnapshot.caseData);
      if (nextSnapshot.caseData === null) {
        setSelectedWorkflowRun(null);
      }
      setLoadState(nextSnapshot.loadState);
      setError(nextSnapshot.error);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadCaseDetails() {
      setLoadState("loading");
      setError(null);

      try {
        const nextCaseData = await fetchCaseAggregate(caseId);
        if (!active) {
          return;
        }

        const nextSnapshot = resolveCaseAggregateSnapshot({
          currentData: null,
          nextData: nextCaseData,
        });
        setCaseData(nextSnapshot.caseData);
        setSelectedWorkflowRun(null);
        setLoadState(nextSnapshot.loadState);
      } catch (requestError: unknown) {
        if (!active) {
          return;
        }

        const errorState =
          requestError instanceof CaseRequestError
            ? requestError
            : new CaseRequestError("error", getErrorMessage(requestError));
        const nextSnapshot = resolveCaseAggregateSnapshot({
          currentData: null,
          requestError: {
            kind: errorState.kind,
            message: errorState.message,
          },
        });
        setCaseData(nextSnapshot.caseData);
        setSelectedWorkflowRun(null);
        setError(nextSnapshot.error);
        setLoadState(nextSnapshot.loadState);
      }
    }

    void loadCaseDetails();

    return () => {
      active = false;
    };
  }, [caseId]);

  const viewModel = caseData ? buildCommandCenterViewModel(caseData) : null;
  const statusBadge = getStatusBadge(loadState, caseData);
  const statusPresentation = caseData ? getStatusPresentation(caseData.status) : null;
  const showProcessAction =
    caseData !== null &&
    statusPresentation !== null &&
    canRenderProcessAction(statusPresentation.nextActionLabel, statusPresentation.targetWorkflowKey);

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

  return (
    <div className={styles.landingRoot} style={{ minHeight: "100vh" }}>
      <header className={styles.navShell}>
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

      <main style={{ padding: "40px 32px 80px", maxWidth: "1440px", margin: "0 auto" }}>
        <div style={{ marginBottom: 32, borderBottom: "1px solid var(--grid)", paddingBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "13px", color: "var(--muted)", flexWrap: "wrap" }}>
                <span>
                  CASE: <strong style={{ color: "var(--ink)" }}>{caseId}</strong>
                </span>
                <span>
                  MEMBER:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.memberId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                </span>
                <span>
                  POLICY:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.policyId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                </span>
                <span>
                  PROVIDER:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {viewModel?.caseRecord.hospitalId ?? (snapshotAvailable ? "NO RECORD" : "UNAVAILABLE")}
                  </strong>
                </span>
              </div>
            </div>

            {showProcessAction && statusPresentation !== null && (
              <button
                onClick={() => void handleProcessCase()}
                disabled={processing}
                className={styles.btnPrimary}
                style={{ opacity: processing ? 0.6 : 1, cursor: processing ? "not-allowed" : "pointer" }}
              >
                {processing ? "PROCESSING 202 QUEUED..." : `${statusPresentation.nextActionLabel!} →`}
              </button>
            )}
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

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, marginBottom: 48 }}>
          <div
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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

          <div style={{ background: "var(--surface)", border: "1px solid var(--forest)", padding: 32 }}>
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
                {viewModel && viewModel.decision.factors.length > 0 ? (
                  viewModel.decision.factors.map((factor) => (
                    <div key={factor} style={{ color: "var(--forest)", fontWeight: 600 }}>
                      {factor}
                    </div>
                  ))
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

        <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32, marginBottom: 48 }}>
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

          {viewModel && viewModel.workflow.runs.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
              {viewModel.workflow.runs.map((workflowRun, index) => (
                <div
                  key={workflowRun.id}
                  onClick={() => setSelectedWorkflowRun(workflowRun)}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--grid)",
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.borderColor = "var(--forest)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.borderColor = "var(--grid)";
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
                      color: getWorkflowStatusColor(workflowRun.status),
                    }}
                  >
                    ● {formatStatusLabel(workflowRun.status)}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 6 }}>
                    Updated {formatDateTime(workflowRun.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16, color: "var(--muted)", fontSize: "13px" }}>
              {summaryStateMessage ?? "No workflow runs recorded for this case."}
            </div>
          )}

          {selectedWorkflowRun && (
            <div style={{ marginTop: 24, padding: 20, background: "var(--bg)", border: "1px solid var(--forest)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--forest)", letterSpacing: "0.14em" }}>
                  TECHNICAL WORKFLOW RUN INSPECTION
                </span>
                <button
                  onClick={() => setSelectedWorkflowRun(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                >
                  X
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 12, fontSize: "12px" }}>
                <div>
                  Workflow: <strong>{selectedWorkflowRun.workflowName}</strong>
                </div>
                <div>
                  Workflow key: <strong>{selectedWorkflowRun.workflowKey}</strong>
                </div>
                <div>
                  Status: <strong>{formatStatusLabel(selectedWorkflowRun.status)}</strong>
                </div>
                <div>
                  Local run ID: <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.id}</code>
                </div>
                <div>
                  Yoxa run ID:{" "}
                  <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.yoxaExecutionId ?? "NOT RECORDED"}</code>
                </div>
                <div>
                  Attempt: <strong>{selectedWorkflowRun.attempt}</strong>
                </div>
                <div>Queued: <strong>{formatDateTime(selectedWorkflowRun.queuedAt)}</strong></div>
                <div>Started: <strong>{formatDateTime(selectedWorkflowRun.startedAt)}</strong></div>
                <div>Completed: <strong>{formatDateTime(selectedWorkflowRun.completedAt)}</strong></div>
                <div>Failed: <strong>{formatDateTime(selectedWorkflowRun.failedAt)}</strong></div>
                <div>Created: <strong>{formatDateTime(selectedWorkflowRun.createdAt)}</strong></div>
                <div>Updated: <strong>{formatDateTime(selectedWorkflowRun.updatedAt)}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "13px" }}>
              {viewModel && viewModel.audit.events.length > 0 ? (
                viewModel.audit.events.map((auditEvent) => (
                  <div
                    key={auditEvent.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingBottom: 8,
                      borderBottom: "1px solid var(--grid)",
                      gap: 16,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>
                      {formatDateTime(auditEvent.createdAt)} • {auditEvent.eventType}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--forest)" }}>
                      {auditEvent.agentRunId ?? "SYSTEM"}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--muted)" }}>{summaryStateMessage ?? "No audit events recorded for this case."}</div>
              )}
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
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
              {viewModel?.packet.record?.pdfUrl ? "PACKET RECORDED WITH PDF" : summaryStateMessage ?? "NO PACKET PDF RECORDED"}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
