"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD_WORKFLOW_KEYS,
  calculateDashboardMetrics,
  formatDashboardMetricValue,
  getSnapshotIndicator,
  type HealthStatus,
} from "@/lib/dashboard/metrics";
import styles from "@/components/landing/landing.module.css";
import { createClient } from "@/utils/supabase/client";
import { getStatusPresentation } from "@/lib/workflow/presentation";
import type { CaseRecord } from "@/types/workflow";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getWorkflowLabel(workflowKey: (typeof DASHBOARD_WORKFLOW_KEYS)[number]): string {
  switch (workflowKey) {
    case "intake":
      return "INTAKE CONFIG";
    case "preauth":
      return "PRE-AUTH CONFIG";
    case "materialChange":
      return "MATERIAL CHANGE CONFIG";
    case "discharge":
      return "DISCHARGE CONFIG";
    case "settlement":
      return "SETTLEMENT CONFIG";
    case "appeal":
      return "APPEAL CONFIG";
  }
}

export default function CoverageOperationsDashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseSnapshotUnavailable, setCaseSnapshotUnavailable] = useState(false);
  const [systemHealth, setSystemHealth] = useState<HealthStatus | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardSnapshot() {
      setLoading(true);
      setCaseSnapshotUnavailable(false);
      setSystemHealth(null);

      try {
        const supabase = createClient();
        const { data: casesData, error: casesError } = await supabase
          .from("cases")
          .select("*")
          .order("created_at", { ascending: false });

        if (cancelled) {
          return;
        }

        if (casesError) {
          setCases([]);
          setCaseSnapshotUnavailable(true);
        } else {
          setCases(casesData ?? []);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error(
            "Error fetching dashboard case snapshot:",
            getErrorMessage(error)
          );
          setCases([]);
          setCaseSnapshotUnavailable(true);
        }
      }

      try {
        const healthResponse = await fetch("/api/health", { cache: "no-store" });

        if (cancelled) {
          return;
        }

        if (healthResponse.ok) {
          const healthPayload = (await healthResponse.json()) as HealthStatus;
          setSystemHealth(healthPayload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error(
            "Error fetching dashboard health snapshot:",
            getErrorMessage(error)
          );
          setSystemHealth(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboardSnapshot();

    return () => {
      cancelled = true;
    };
  }, [snapshotVersion]);

  const seedDemoCase = async () => {
    try {
      await fetch("/api/workflow/seed", { method: "POST" });
      setSnapshotVersion((currentVersion) => currentVersion + 1);
    } catch (error: unknown) {
      console.error("Error seeding dashboard demo case:", getErrorMessage(error));
    }
  };

  const metrics = caseSnapshotUnavailable ? null : calculateDashboardMetrics(cases);
  const goldenCase =
    caseSnapshotUnavailable
      ? null
      : cases.find((caseRecord) =>
          caseRecord.case_id.includes("REAL") || caseRecord.case_id.includes("0001")
        ) ?? cases[0] ?? null;
  const snapshotIndicator = getSnapshotIndicator({
    systemHealth,
    caseSnapshotUnavailable,
    loading,
  });
  const configuredWorkflowCount = systemHealth
    ? DASHBOARD_WORKFLOW_KEYS.filter(
        (workflowKey) => systemHealth.workflows[workflowKey].configured
      ).length
    : 0;
  const healthFallbackLabel = loading ? "LOADING" : "UNAVAILABLE";

  return (
    <div className={styles.landingRoot} style={{ minHeight: "100vh" }}>
      {/* A1 — HEADER */}
      <header className={styles.navShell}>
        <div className={styles.navLeft}>
          <span className={styles.navMark} aria-hidden="true" />
          <div>
            <div className={styles.navTitle}>COVERAGE TWIN</div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--forest)" }}>
              DECISION OPERATIONS
            </div>
          </div>
        </div>

        <div className={styles.navRight}>
          <span className={styles.navScrollLink}>CASES</span>
          <span className={styles.navScrollLink}>OPERATIONS</span>
          <span className={styles.navScrollLink}>AUDIT</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: snapshotIndicator.background, color: snapshotIndicator.color, padding: "4px 10px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", borderRadius: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: snapshotIndicator.dot }} />
            {snapshotIndicator.label}
          </div>
        </div>
      </header>

      <main style={{ padding: "40px 32px 80px", maxWidth: "1440px", margin: "0 auto" }}>
        {/* DASHBOARD TITLE BLOCK */}
        <div style={{ marginBottom: 40, borderBottom: "1px solid var(--grid)", paddingBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontSize: "clamp(36px, 4vw, 68px)", fontWeight: 300, letterSpacing: "-0.04em", margin: 0, textTransform: "uppercase" }}>
                Coverage <strong>Operations</strong>
              </h1>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "15px", letterSpacing: "0.04em" }}>
                One-time current snapshot of persisted case activity and workflow configuration.
              </p>
            </div>
            
            {/* Subtle Demo Control Button */}
            <button
              onClick={seedDemoCase}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--grid)",
                color: "var(--ink)",
                padding: "8px 16px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: "pointer",
                borderRadius: 2
              }}
            >
              + NEW CASE / SEED DEMO
            </button>
          </div>
        </div>

        {/* A2 — OPERATIONAL METRICS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 24,
          padding: "24px 0",
          borderTop: "1px solid var(--grid)",
          borderBottom: "1px solid var(--grid)",
          marginBottom: 48
        }}>
          <div>
            <div style={{ fontSize: "48px", fontWeight: 300, color: "var(--forest)", lineHeight: 1 }}>
              {formatDashboardMetricValue(metrics?.activeCases ?? null)}
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted)", marginTop: 6, textTransform: "uppercase" }}>
              Active Cases
            </div>
          </div>

          <div>
            <div style={{ fontSize: "48px", fontWeight: 300, color: "var(--forest)", lineHeight: 1 }}>
              {formatDashboardMetricValue(metrics?.decisionReadyCases ?? null)}
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted)", marginTop: 6, textTransform: "uppercase" }}>
              Decision Ready
            </div>
          </div>

          <div>
            <div style={{ fontSize: "48px", fontWeight: 300, color: "var(--forest)", lineHeight: 1 }}>
              {formatDashboardMetricValue(metrics?.authorisedCases ?? null)}
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted)", marginTop: 6, textTransform: "uppercase" }}>
              Authorised
            </div>
          </div>

          <div>
            <div style={{ fontSize: "48px", fontWeight: 300, color: "var(--forest)", lineHeight: 1 }}>
              {formatDashboardMetricValue(metrics?.exceptionCases ?? null)}
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", color: "var(--muted)", marginTop: 6, textTransform: "uppercase" }}>
              Exceptions
            </div>
          </div>
        </div>

        {/* GRID: FEATURED CASE & LIVE INFRASTRUCTURE */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, marginBottom: 48 }}>
          
          {/* A3 — FEATURED GOLDEN CASE CARD */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--forest)",
            boxShadow: "6px 6px 0 var(--forest)",
            padding: 32,
            position: "relative"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", color: "var(--forest)", textTransform: "uppercase" }}>
                ★ FEATURED GOLDEN CASE
              </span>
              {goldenCase && (
                <span style={{
                  background: getStatusPresentation(goldenCase.current_case_status).badgeBg,
                  color: getStatusPresentation(goldenCase.current_case_status).badgeText,
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  borderRadius: 2
                }}>
                  ● {getStatusPresentation(goldenCase.current_case_status).label}
                </span>
              )}
            </div>

            <h3 style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)", margin: "0 0 4px 0" }}>
              {goldenCase
                ? goldenCase.case_id
                : caseSnapshotUnavailable
                  ? "Case snapshot unavailable"
                  : "No persisted cases yet"}
            </h3>
            <p style={{ fontSize: "15px", color: "var(--muted)", margin: "0 0 20px 0" }}>
              {goldenCase
                ? goldenCase.planned_procedure
                : caseSnapshotUnavailable
                  ? "The cases read failed, so this snapshot cannot identify a featured case."
                  : "Seed a case to populate the current snapshot."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "16px 0", borderTop: "1px solid var(--grid)", borderBottom: "1px solid var(--grid)", marginBottom: 24 }}>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>MEMBER</span>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>
                  {goldenCase?.member_id ?? "—"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>REQUESTED</span>
                <div style={{ fontSize: "18px", fontWeight: 300, color: "var(--forest)" }}>
                  —
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>STAGE</span>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--forest)" }}>
                  {goldenCase
                    ? getStatusPresentation(goldenCase.current_case_status).label
                    : "—"}
                </div>
              </div>
            </div>

            {goldenCase ? (
              <Link
                href={`/dashboard/cases/${goldenCase.case_id}`}
                className={styles.btnPrimary}
                style={{ display: "inline-flex", textDecoration: "none" }}
              >
                Open Case Command Center →
              </Link>
            ) : (
              <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>
                No case available in this snapshot
              </span>
            )}
          </div>

          {/* A5 — CURRENT SYSTEM STATE */}
          <div style={{
            background: "var(--bg)",
            border: "1px solid var(--grid)",
            padding: 32
          }}>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.18em", color: "var(--forest)", textTransform: "uppercase", marginBottom: 20 }}>
              CURRENT SYSTEM STATE
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>SNAPSHOT STATUS</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>{snapshotIndicator.label}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>DATABASE CONFIGURATION</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>
                  {systemHealth
                    ? systemHealth.database.configured
                      ? "CONFIGURED"
                      : "MISSING"
                    : healthFallbackLabel}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>DATABASE REACHABILITY</span>
                <span style={{ fontWeight: 700, color: "var(--forest)" }}>
                  {systemHealth
                    ? systemHealth.database.reachable
                      ? "REACHABLE"
                      : "UNAVAILABLE"
                    : healthFallbackLabel}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--grid)" }}>
                <span style={{ color: "var(--muted)" }}>WORKFLOW CONFIGS PRESENT</span>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                  {systemHealth
                    ? `${configuredWorkflowCount} / ${DASHBOARD_WORKFLOW_KEYS.length}`
                    : healthFallbackLabel}
                </span>
              </div>
              {DASHBOARD_WORKFLOW_KEYS.map((workflowKey) => (
                <div
                  key={workflowKey}
                  style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: workflowKey === "appeal" ? "none" : "1px solid var(--grid)" }}
                >
                  <span style={{ color: "var(--muted)" }}>{getWorkflowLabel(workflowKey)}</span>
                  <span style={{ fontWeight: 700, color: "var(--forest)" }}>
                    {systemHealth
                      ? systemHealth.workflows[workflowKey].configured
                        ? "PRESENT"
                        : "MISSING"
                      : healthFallbackLabel}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6 }}>
                <span style={{ color: "var(--muted)" }}>SNAPSHOT TIME</span>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                  {systemHealth?.timestamp ?? healthFallbackLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* A4 — CASE QUEUE LEDGER */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Case Operational Queue
            </h2>
            <span style={{ fontSize: "12px", color: "var(--muted)", letterSpacing: "0.1em" }}>
              {caseSnapshotUnavailable
                ? "CASE SNAPSHOT UNAVAILABLE"
                : `${cases.length} PERSISTED RECORDS`}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 40, background: "var(--surface)", border: "1px solid var(--grid)", color: "var(--muted)" }}>
              Loading current case snapshot...
            </div>
          ) : caseSnapshotUnavailable ? (
            <div style={{ padding: 40, background: "var(--surface)", border: "1px solid var(--grid)", color: "var(--muted)" }}>
              The current case snapshot is unavailable because the cases read failed.
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: 40, background: "var(--surface)", border: "1px solid var(--grid)", color: "var(--muted)" }}>
              No persisted cases are present in the current snapshot. Click &quot;+ NEW CASE / SEED DEMO&quot; to add one.
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--forest)" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.2fr 2fr 1.8fr 0.8fr 1fr",
                padding: "14px 20px",
                background: "var(--forest)",
                color: "var(--lime)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase"
              }}>
                <div>CASE ID</div>
                <div>MEMBER</div>
                <div>PROCEDURE</div>
                <div>CURRENT STATE</div>
                <div>VERSION</div>
                <div style={{ textAlign: "right" }}>ACTION</div>
              </div>

              {cases.map((c) => {
                const pres = getStatusPresentation(c.current_case_status);
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/cases/${c.case_id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1.2fr 2fr 1.8fr 0.8fr 1fr",
                      padding: "18px 20px",
                      borderBottom: "1px solid var(--grid)",
                      alignItems: "center",
                      textDecoration: "none",
                      color: "var(--ink)",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontWeight: 700, fontSize: "14px" }}>{c.case_id}</div>
                    <div style={{ fontSize: "13px", color: "var(--muted)" }}>{c.member_id}</div>
                    <div style={{ fontSize: "14px" }}>{c.planned_procedure}</div>
                    <div>
                      <span style={{
                        background: pres.badgeBg,
                        color: pres.badgeText,
                        padding: "4px 10px",
                        fontSize: "10px",
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        borderRadius: 2,
                        textTransform: "uppercase"
                      }}>
                        ● {pres.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>v{c.case_version}</div>
                    <div style={{ textAlign: "right", fontWeight: 700, color: "var(--forest)", fontSize: "13px" }}>
                      OPEN →
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* A6 — LIFECYCLE OVERVIEW */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--grid)", padding: 32, marginBottom: 48 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--forest)", textTransform: "uppercase", margin: "0 0 16px 0" }}>
            Coverage Twin Case Lifecycle Architecture
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            <div style={{ borderLeft: "2px solid var(--forest)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>01 INTAKE</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Context Normalised</div>
            </div>
            <div style={{ borderLeft: "2px solid var(--forest)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>02 PRE-AUTH</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Coverage & Necessity</div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>03 DISCHARGE</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Outcome Evidence</div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>04 SETTLEMENT</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Bill Reconciliation</div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>05 CLOSED</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>Case Record Finalised</div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
