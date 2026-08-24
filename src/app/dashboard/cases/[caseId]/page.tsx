"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getStatusPresentation, demoPresentationData } from "@/lib/workflow/presentation";
import { buildProcessRequestBody, canRenderProcessAction } from "@/lib/yoxa/process-request";
import styles from "@/components/landing/landing.module.css";

interface WorkflowRunSummary {
  id?: string;
  workflow_name?: string;
  workflow_key?: string;
  yoxa_workflow_run_id?: string;
  execution_state?: string;
}

interface DecisionPacketSummary {
  packet_id?: string;
}

interface CaseDetailResponse {
  success?: boolean;
  case_id: string;
  member_id: string;
  planned_procedure: string;
  current_case_status: string;
  case_version: number;
  workflow_runs?: WorkflowRunSummary[];
  audit_events?: unknown[];
  decision_packet?: DecisionPacketSummary | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

async function fetchCaseDetailResponse(caseId: string): Promise<CaseDetailResponse> {
  const res = await fetch(`/api/cases/${caseId}`);
  if (!res.ok) {
    throw new Error(`Failed to load case data: ${res.statusText}`);
  }

  return (await res.json()) as CaseDetailResponse;
}

export default function CaseCommandCenterPage({ params }: { params: Promise<{ caseId: string }> }) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedWorkflowRun, setSelectedWorkflowRun] = useState<WorkflowRunSummary | null>(null);

  const refreshCaseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      setCaseData(await fetchCaseDetailResponse(caseId));
    } catch (err: unknown) {
      console.error("Error fetching case details:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    const loadCaseDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextCaseData = await fetchCaseDetailResponse(caseId);
        if (isCurrent) {
          setCaseData(nextCaseData);
        }
      } catch (err: unknown) {
        console.error("Error fetching case details:", err);
        if (isCurrent) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    void loadCaseDetails();

    return () => {
      isCurrent = false;
    };
  }, [caseId]);

  const handleProcessCase = async () => {
    if (processing || !caseData) return;
    setProcessing(true);
    try {
      const pres = getStatusPresentation(caseData.current_case_status);
      const workflowKey = pres.targetWorkflowKey;

      if (!workflowKey) {
        throw new Error("No workflow key is available for the current case status");
      }

      const res = await fetch(`/api/cases/${caseId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProcessRequestBody(workflowKey)),
      });

      if (!res.ok) {
        throw new Error("Failed to process case workflow step");
      }

      // Refresh case details after processing request
      setTimeout(() => {
        void refreshCaseDetails();
      }, 1200);
    } catch (err: unknown) {
      alert(`Process Case Error: ${getErrorMessage(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  const pres = getStatusPresentation(caseData?.current_case_status || "DECISION_READY");
  const showProcessAction = canRenderProcessAction(pres.nextActionLabel, pres.targetWorkflowKey);

  return (
    <div className={styles.landingRoot} style={{ minHeight: "100vh" }}>
      {/* B1 — HEADER */}
      <header className={styles.navShell}>
        <div className={styles.navLeft}>
          <Link href="/dashboard" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            ← BACK TO OPERATIONS
          </Link>
          <span style={{ color: "var(--grid)" }}>|</span>
          <span className={styles.navTitle}>CASE COMMAND CENTER</span>
        </div>

        <div className={styles.navRight}>
          <span style={{
            background: pres.badgeBg,
            color: pres.badgeText,
            padding: "4px 12px",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderRadius: 2
          }}>
            ● {pres.label}
          </span>
        </div>
      </header>

      <main style={{ padding: "40px 32px 80px", maxWidth: "1440px", margin: "0 auto" }}>
        
        {/* B1 — CASE TITLE & METADATA BLOCK */}
        <div style={{ marginBottom: 32, borderBottom: "1px solid var(--grid)", paddingBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em", color: "var(--forest)", textTransform: "uppercase", marginBottom: 6 }}>
                CANONICAL COVERAGE CASE RECORD
              </div>
              <h1 style={{ fontSize: "clamp(32px, 3.5vw, 56px)", fontWeight: 300, letterSpacing: "-0.03em", margin: 0, textTransform: "uppercase" }}>
                {caseData ? caseData.planned_procedure : demoPresentationData.defaultProcedure}
              </h1>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "13px", color: "var(--muted)" }}>
                <span>CASE: <strong style={{ color: "var(--ink)" }}>{caseId}</strong></span>
                <span>MEMBER: <strong style={{ color: "var(--ink)" }}>{caseData?.member_id || demoPresentationData.defaultMemberName}</strong></span>
                <span>POLICY: <strong style={{ color: "var(--ink)" }}>{demoPresentationData.defaultPolicyId}</strong></span>
                <span>PROVIDER: <strong style={{ color: "var(--ink)" }}>{demoPresentationData.defaultHospitalId}</strong></span>
              </div>
            </div>

            {/* ACTION BAR */}
            {showProcessAction && (
              <button
                onClick={handleProcessCase}
                disabled={processing}
                className={styles.btnPrimary}
                style={{ opacity: processing ? 0.6 : 1, cursor: processing ? "not-allowed" : "pointer" }}
              >
                {processing ? "PROCESSING 202 QUEUED..." : `${pres.nextActionLabel!} →`}
              </button>
            )}
          </div>
        </div>

        {loading && !caseData && (
          <div style={{ marginBottom: 24, color: "var(--muted)", fontSize: "13px" }}>
            Loading case details...
          </div>
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

        {/* B2 — EXECUTIVE SUMMARY STRIP */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 24,
          padding: "20px 24px",
          background: "var(--surface)",
          border: "1px solid var(--grid)",
          marginBottom: 40
        }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>REQUESTED AMOUNT</span>
            <div style={{ fontSize: "28px", fontWeight: 300, color: "var(--forest)", marginTop: 2 }}>
              {demoPresentationData.defaultRequestedAmount}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>RECOMMENDED BENEFIT</span>
            <div style={{ fontSize: "28px", fontWeight: 300, color: "var(--forest)", marginTop: 2 }}>
              {demoPresentationData.defaultAdmissibleAmount}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>CURRENT STAGE</span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
              PRE-AUTHORISATION
            </div>
          </div>

          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>CASE VERSION</span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
              v{caseData?.case_version || 1}
            </div>
          </div>
        </div>

        {/* B3 & B4 — COVERAGE TWIN CORE GRID & DECISION PANEL */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, marginBottom: 48 }}>
          
          {/* B3 — COVERAGE TWIN DOMAIN GRID */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--forest)", boxShadow: "6px 6px 0 var(--forest)", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 12, borderBottom: "1px solid var(--grid)" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--forest)", margin: 0, textTransform: "uppercase" }}>
                COVERAGE TWIN CANONICAL STATE
              </h2>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--lime)", background: "var(--forest)", padding: "4px 8px" }}>
                SYNCHRONISED
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              
              {/* MEMBER DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>MEMBER DOMAIN</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{caseData?.member_id || demoPresentationData.defaultMemberName}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Identity & Policyholder Validated</div>
              </div>

              {/* POLICY DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>POLICY DOMAIN</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{demoPresentationData.defaultPolicyId}</div>
                <div style={{ fontSize: "12px", color: "var(--forest)", fontWeight: 600, marginTop: 4 }}>✓ Coverage Active • Waiting Period Cleared</div>
              </div>

              {/* CLINICAL DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>CLINICAL DOMAIN</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>ICD-10 K80.1 • CPT 47562</div>
                <div style={{ fontSize: "12px", color: "var(--forest)", fontWeight: 600, marginTop: 4 }}>✓ Surgical Indication & USG Confirmed</div>
              </div>

              {/* PROVIDER DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>PROVIDER DOMAIN</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>HSP-NIR-021</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Tier-1 Network Hospital • Agreement Active</div>
              </div>

              {/* FINANCIAL DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>FINANCIAL DOMAIN</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>₹85,000 Admissible</div>
                <div style={{ fontSize: "12px", color: "var(--forest)", fontWeight: 600, marginTop: 4 }}>✓ Tariff Breakdown Matched (0% Co-pay)</div>
              </div>

              {/* EVIDENCE DOMAIN */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 6 }}>EVIDENCE PROVENANCE</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>4 Verified Artifacts</div>
                <div style={{ fontSize: "12px", color: "var(--forest)", fontWeight: 600, marginTop: 4 }}>✓ Clinical Scan & Doctor Note Verified</div>
              </div>

            </div>
          </div>

          {/* B4 — DECISION & HUMAN GOVERNANCE PANEL */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--forest)", padding: 32 }}>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em", color: "var(--forest)", textTransform: "uppercase", marginBottom: 16 }}>
              AI RECOMMENDATION & DECISION BASIS
            </div>

            <div style={{ background: "var(--forest)", color: "var(--lime)", padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em" }}>RECOMMENDED ACTION</div>
              <div style={{ fontSize: "32px", fontWeight: 300, margin: "4px 0" }}>
                AUTHORISE ₹85,000
              </div>
              <div style={{ fontSize: "12px", color: "var(--bg)" }}>
                Pre-authorisation recommendation derived from 6 Yoxa workflow steps.
              </div>
            </div>

            {/* DECISION SUPPORT REASONS */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10 }}>
                VERIFIED DECISION SUPPORT FACTORS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "13px" }}>
                <div style={{ color: "var(--forest)", fontWeight: 600 }}>✓ Coverage terms & active policy limits confirmed</div>
                <div style={{ color: "var(--forest)", fontWeight: 600 }}>✓ Clinical necessity & procedure coding supported</div>
                <div style={{ color: "var(--forest)", fontWeight: "600" }}>✓ Evidence completeness & provenance verified</div>
                <div style={{ color: "var(--forest)", fontWeight: 600 }}>✓ Requested hospital tariff admissible</div>
              </div>
            </div>

            {/* B8 — HUMAN GOVERNANCE STATE */}
            <div style={{ padding: 16, background: "var(--bg)", border: "1px solid var(--grid)" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "var(--forest)", marginBottom: 4 }}>
                HUMAN GOVERNANCE STATE
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                APPROVAL CURRENTLY MANAGED IN YOXA
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Human approval node is active inside native Yoxa workflow dashboard.
              </div>
            </div>
          </div>
        </div>

        {/* B5 — WORKFLOW JOURNEY TIMELINE */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32, marginBottom: 48 }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--forest)", textTransform: "uppercase", margin: "0 0 24px 0" }}>
            Yoxa Deployed Workflows Execution Trail
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
            {caseData?.workflow_runs && caseData.workflow_runs.length > 0 ? (
              caseData.workflow_runs.map((run, idx) => (
                <div
                  key={run.id || idx}
                  onClick={() => setSelectedWorkflowRun(run)}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--grid)",
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--forest)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--grid)")}
                >
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>0{idx + 1} WORKFLOW</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>
                    {run.workflow_key || "WORKFLOW"}
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: run.execution_state === "COMPLETED" ? "var(--forest)" : "var(--amber)" }}>
                    ● {run.execution_state}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>01 INTAKE</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>Care Intake</div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--forest)" }}>✓ COMPLETED</span>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--lime)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>02 PRE-AUTH</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>Pre-authorisation</div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--forest)" }}>● DECISION READY</span>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>03 MATERIAL CHANGE</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", margin: "4px 0" }}>Re-evaluation</div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>CONDITIONAL</span>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>04 DISCHARGE</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", margin: "4px 0" }}>Discharge Evidence</div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>STANDBY</span>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>05 SETTLEMENT</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", margin: "4px 0" }}>Bill Reconciliation</div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>STANDBY</span>
                </div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--grid)", padding: 16 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>06 APPEAL</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", margin: "4px 0" }}>Dispute Resolution</div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>CONDITIONAL</span>
                </div>
              </>
            )}
          </div>

          {/* Technical Workflow Run Detail Drawer */}
          {selectedWorkflowRun && (
            <div style={{ marginTop: 24, padding: 20, background: "var(--bg)", border: "1px solid var(--forest)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--forest)", letterSpacing: "0.14em" }}>
                  TECHNICAL WORKFLOW RUN INSPECTION
                </span>
                <button onClick={() => setSelectedWorkflowRun(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 12, fontSize: "12px" }}>
                <div>Workflow: <strong>{selectedWorkflowRun.workflow_name || selectedWorkflowRun.workflow_key}</strong></div>
                <div>Yoxa Run ID: <code style={{ fontSize: "11px" }}>{selectedWorkflowRun.yoxa_workflow_run_id || selectedWorkflowRun.id}</code></div>
                <div>State: <strong>{selectedWorkflowRun.execution_state}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* B9 & B10 — AUDIT TRAIL & DECISION PACKET */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32 }}>
          {/* B9 — AUDIT TRAIL */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--forest)", textTransform: "uppercase", margin: "0 0 20px 0" }}>
              Case Operational Audit Trail
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>05:41:12 • INTAKE WORKFLOW ACCEPTED</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>SYSTEM</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>05:41:14 • CASE STATE PERSISTED (SUPABASE)</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>PERSISTENCE</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>05:41:26 • PRE-AUTH RECOMMENDATION READY</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>YOXA REASONER</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>05:42:01 • YOXA HUMAN APPROVAL NODE ACTIVE</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>HITL GOVERNANCE</span>
              </div>
            </div>
          </div>

          {/* B10 — DECISION PACKET RECORD */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32 }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--forest)", textTransform: "uppercase", margin: "0 0 16px 0" }}>
              Durable Decision Packet
            </h3>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              {caseData?.decision_packet ? caseData.decision_packet.packet_id || "PKT-CASE-CT-REAL-001-V1" : "PKT-CASE-CT-REAL-001-V1"}
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "8px 0 16px 0" }}>
              The recommendation, evidence, reviewer action and timestamps collapse into one defensible record.
            </p>
            <div style={{ display: "inline-block", background: "var(--bg)", border: "1px solid var(--forest)", padding: "6px 12px", fontSize: "11px", fontWeight: 700, color: "var(--forest)" }}>
              PACKET RECORDED IN PERSISTENT STORAGE
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
