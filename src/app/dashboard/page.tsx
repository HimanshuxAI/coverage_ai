"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "@/components/landing/landing.module.css";
import {
  buildDashboardCaseConsole,
  DASHBOARD_SORT_KEYS,
  DASHBOARD_STATUS_FILTERS,
  resolveSeedDemoCaseResult,
  type DashboardActionFeedback,
  type DashboardSortKey,
  type DashboardStatusFilterKey,
} from "@/lib/dashboard/case-console";
import {
  DASHBOARD_WORKFLOW_KEYS,
  calculateDashboardMetrics,
  formatDashboardMetricValue,
  getSnapshotIndicator,
  type HealthStatus,
} from "@/lib/dashboard/metrics";
import { getStatusPresentation } from "@/lib/workflow/presentation";
import type { CaseRecord } from "@/types/workflow";
import { createClient } from "@/utils/supabase/client";

const FILTER_LABELS: Record<DashboardStatusFilterKey, string> = {
  ALL: "All",
  ACTIVE: "Active",
  DECISION_READY: "Decision Ready",
  AUTHORISED: "Authorised",
  EXCEPTION: "Exception",
};

const SORT_LABELS: Record<DashboardSortKey, string> = {
  UPDATED_DESC: "Updated: Newest First",
  UPDATED_ASC: "Updated: Oldest First",
  CASE_ID_ASC: "Case ID: A-Z",
  STATUS_ASC: "Status: A-Z",
};

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
  const router = useRouter();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseSnapshotUnavailable, setCaseSnapshotUnavailable] = useState(false);
  const [systemHealth, setSystemHealth] = useState<HealthStatus | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilterKey>("ALL");
  const [sortKey, setSortKey] = useState<DashboardSortKey>("UPDATED_DESC");
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<DashboardActionFeedback | null>(null);

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
          .select("*");

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
          setRefreshing(false);
        }
      }
    }

    void loadDashboardSnapshot();

    return () => {
      cancelled = true;
    };
  }, [snapshotVersion]);

  async function seedDemoCase() {
    setActionFeedback(null);
    setSeeding(true);

    try {
      const response = await fetch("/api/workflow/seed", { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      const feedback = resolveSeedDemoCaseResult({
        ok: response.ok,
        payload,
        status: response.status,
      });

      setActionFeedback(feedback);

      if (feedback.kind === "success") {
        setRefreshing(true);
        setSnapshotVersion((currentVersion) => currentVersion + 1);
      }
    } catch (error: unknown) {
      console.error("Error seeding dashboard demo case:", getErrorMessage(error));
      setActionFeedback({
        kind: "error",
        message: "Unable to seed the demo case right now.",
      });
    } finally {
      setSeeding(false);
    }
  }

  function refreshDashboardSnapshot() {
    setActionFeedback(null);
    setRefreshing(true);
    setSnapshotVersion((currentVersion) => currentVersion + 1);
  }

  const metrics = caseSnapshotUnavailable ? null : calculateDashboardMetrics(cases);
  const caseConsole = caseSnapshotUnavailable
    ? null
    : buildDashboardCaseConsole(cases, {
        searchTerm,
        statusFilter,
        sortKey,
      });
  const visibleCases = caseConsole?.visibleCases ?? [];
  const featuredCase = caseConsole?.featuredCase ?? null;
  const hasVisibleFilters = searchTerm.trim().length > 0 || statusFilter !== "ALL";
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
  const healthFallbackLabel = loading ? "LOADING" : "STATUS UNAVAILABLE";
  const controlStateDisabled = loading || caseSnapshotUnavailable || cases.length === 0;

  return (
    <div className={styles.landingRoot} style={{ minHeight: "100vh" }}>
      <header className={styles.navShell}>
        <Link
          className={styles.navLeft}
          href="/"
          aria-label="Go to Coverage Twin landing page"
          onClick={(event) => {
            event.preventDefault();
            router.push("/");
          }}
        >
          <span className={styles.navMark} aria-hidden="true" />
          <div>
            <div className={styles.navTitle}>COVERAGE TWIN</div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--forest)",
              }}
            >
              DECISION OPERATIONS
            </div>
          </div>
        </Link>

        <div
          className={styles.navRight}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
        >
          <Link href="/" className={styles.navScrollLink}>
            HOME
          </Link>
          <a href="#operations" className={styles.navScrollLink}>
            OPERATIONS
          </a>
          <a href="#cases" className={styles.navScrollLink}>
            CASES
          </a>
          <a href="#system" className={styles.navScrollLink}>
            SYSTEM
          </a>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: snapshotIndicator.background,
              color: snapshotIndicator.color,
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              borderRadius: 2,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: snapshotIndicator.dot,
              }}
            />
            {snapshotIndicator.label}
          </div>
        </div>
      </header>

      <main
        style={{
          padding: "40px clamp(16px, 4vw, 32px) 80px",
          maxWidth: "1440px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 40,
            borderBottom: "1px solid var(--grid)",
            paddingBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(36px, 4vw, 68px)",
                  fontWeight: 300,
                  letterSpacing: "-0.04em",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                Coverage <strong>Operations</strong>
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--muted)",
                  fontSize: "15px",
                  letterSpacing: "0.04em",
                }}
              >
                One-time current snapshot of persisted case activity and workflow configuration.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={refreshDashboardSnapshot}
                disabled={loading || refreshing}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--grid)",
                  color: "var(--ink)",
                  padding: "8px 16px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  cursor: loading || refreshing ? "wait" : "pointer",
                  borderRadius: 2,
                  opacity: loading || refreshing ? 0.7 : 1,
                }}
              >
                {loading || refreshing ? "REFRESHING..." : "REFRESH SNAPSHOT"}
              </button>
              <button
                type="button"
                onClick={seedDemoCase}
                disabled={seeding}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--grid)",
                  color: "var(--ink)",
                  padding: "8px 16px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  cursor: seeding ? "wait" : "pointer",
                  borderRadius: 2,
                  opacity: seeding ? 0.7 : 1,
                }}
              >
                {seeding ? "SEEDING..." : "+ NEW CASE / SEED DEMO"}
              </button>
            </div>
          </div>

          {actionFeedback && (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: "16px 0 0",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color:
                  actionFeedback.kind === "error" ? "var(--danger, #B42318)" : "var(--forest)",
                textTransform: "uppercase",
              }}
            >
              {actionFeedback.message}
            </p>
          )}
        </div>

        <section
          id="operations"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 24,
            padding: "24px 0",
            borderTop: "1px solid var(--grid)",
            borderBottom: "1px solid var(--grid)",
            marginBottom: 48,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 300,
                color: "var(--forest)",
                lineHeight: 1,
              }}
            >
              {formatDashboardMetricValue(metrics?.activeCases ?? null)}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--muted)",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              Active Cases
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 300,
                color: "var(--forest)",
                lineHeight: 1,
              }}
            >
              {formatDashboardMetricValue(metrics?.decisionReadyCases ?? null)}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--muted)",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              Decision Ready
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 300,
                color: "var(--forest)",
                lineHeight: 1,
              }}
            >
              {formatDashboardMetricValue(metrics?.authorisedCases ?? null)}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--muted)",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              Authorised
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 300,
                color: "var(--forest)",
                lineHeight: 1,
              }}
            >
              {formatDashboardMetricValue(metrics?.exceptionCases ?? null)}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--muted)",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              Exceptions
            </div>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 32,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--forest)",
              boxShadow: "6px 6px 0 var(--forest)",
              padding: 32,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: "var(--forest)",
                  textTransform: "uppercase",
                }}
              >
                ★ FEATURED CASE
              </span>
              {featuredCase && (
                <span
                  style={{
                    background: getStatusPresentation(featuredCase.current_case_status).badgeBg,
                    color: getStatusPresentation(featuredCase.current_case_status).badgeText,
                    padding: "4px 10px",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    borderRadius: 2,
                  }}
                >
                  ● {getStatusPresentation(featuredCase.current_case_status).label}
                </span>
              )}
            </div>

            <h3
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--ink)",
                margin: "0 0 4px 0",
              }}
            >
              {featuredCase
                ? featuredCase.case_id
                : caseSnapshotUnavailable
                  ? "Case snapshot unavailable"
                  : hasVisibleFilters
                    ? "No cases match the current console filters"
                    : "No persisted cases yet"}
            </h3>
            <p style={{ fontSize: "15px", color: "var(--muted)", margin: "0 0 20px 0" }}>
              {featuredCase
                ? featuredCase.planned_procedure
                : caseSnapshotUnavailable
                  ? "The cases read failed, so this snapshot cannot identify a featured case."
                  : hasVisibleFilters
                    ? "Adjust the search, filter, or sort controls to reveal a matching case."
                    : "Seed a case to populate the current snapshot."}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 16,
                padding: "16px 0",
                borderTop: "1px solid var(--grid)",
                borderBottom: "1px solid var(--grid)",
                marginBottom: 24,
              }}
            >
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>
                  MEMBER
                </span>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>
                  {featuredCase?.member_id ?? "—"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>
                  HOSPITAL
                </span>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>
                  {featuredCase?.hospital_id ?? "—"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.12em" }}>
                  STAGE
                </span>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--forest)" }}>
                  {featuredCase
                    ? getStatusPresentation(featuredCase.current_case_status).label
                    : "—"}
                </div>
              </div>
            </div>

            {featuredCase ? (
              <Link
                href={`/dashboard/cases/${featuredCase.case_id}`}
                className={styles.btnPrimary}
                style={{ display: "inline-flex", textDecoration: "none" }}
              >
                Open Case Command Center →
              </Link>
            ) : (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                No case available in this view
              </span>
            )}
          </div>

          <section
            id="system"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--grid)",
              padding: 32,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: "var(--forest)",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              CURRENT SYSTEM STATE
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "13px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--grid)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>SNAPSHOT STATUS</span>
                <span style={{ fontWeight: 700, color: "var(--forest)", textAlign: "right" }}>
                  {snapshotIndicator.label}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--grid)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>DATABASE CONFIGURATION</span>
                <span style={{ fontWeight: 700, color: "var(--forest)", textAlign: "right" }}>
                  {systemHealth
                    ? systemHealth.database.configured
                      ? "CONFIGURED"
                      : "MISSING"
                    : healthFallbackLabel}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--grid)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>DATABASE REACHABILITY</span>
                <span style={{ fontWeight: 700, color: "var(--forest)", textAlign: "right" }}>
                  {systemHealth
                    ? systemHealth.database.reachable
                      ? "REACHABLE"
                      : "UNAVAILABLE"
                    : healthFallbackLabel}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--grid)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>WORKFLOW CONFIGS PRESENT</span>
                <span style={{ fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                  {systemHealth
                    ? `${configuredWorkflowCount} / ${DASHBOARD_WORKFLOW_KEYS.length}`
                    : healthFallbackLabel}
                </span>
              </div>
              {DASHBOARD_WORKFLOW_KEYS.map((workflowKey) => (
                <div
                  key={workflowKey}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingBottom: 10,
                    borderBottom:
                      workflowKey === "appeal" ? "none" : "1px solid var(--grid)",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{getWorkflowLabel(workflowKey)}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "var(--forest)",
                      textAlign: "right",
                    }}
                  >
                    {systemHealth
                      ? systemHealth.workflows[workflowKey].configured
                        ? "PRESENT"
                        : "MISSING"
                      : healthFallbackLabel}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 6 }}>
                <span style={{ color: "var(--muted)" }}>SNAPSHOT TIME</span>
                <span style={{ fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                  {systemHealth?.timestamp ?? healthFallbackLabel}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section id="cases" style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Case Operational Queue
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                {caseSnapshotUnavailable
                  ? "CASE SNAPSHOT UNAVAILABLE"
                  : `${visibleCases.length} visible of ${cases.length} persisted records`}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                Search Cases
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="Case, member, policy, hospital, procedure, status"
                disabled={controlStateDisabled}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid var(--grid)",
                  borderRadius: 2,
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                Sort Cases
              </span>
              <select
                value={sortKey}
                onChange={(event) =>
                  setSortKey(event.currentTarget.value as DashboardSortKey)
                }
                disabled={controlStateDisabled}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid var(--grid)",
                  borderRadius: 2,
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              >
                {DASHBOARD_SORT_KEYS.map((availableSortKey) => (
                  <option key={availableSortKey} value={availableSortKey}>
                    {SORT_LABELS[availableSortKey]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            role="toolbar"
            aria-label="Case status filters"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            {DASHBOARD_STATUS_FILTERS.map((filterKey) => {
              const isSelected = statusFilter === filterKey;
              const count = caseConsole?.filterCounts[filterKey] ?? 0;

              return (
                <button
                  key={filterKey}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setStatusFilter(filterKey)}
                  disabled={controlStateDisabled}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 2,
                    border: isSelected
                      ? "1px solid var(--forest)"
                      : "1px solid var(--grid)",
                    background: isSelected ? "var(--forest)" : "var(--surface)",
                    color: isSelected ? "var(--lime)" : "var(--ink)",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: controlStateDisabled ? "not-allowed" : "pointer",
                    opacity: controlStateDisabled ? 0.6 : 1,
                  }}
                >
                  <span>{FILTER_LABELS[filterKey]}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div
              style={{
                padding: 40,
                background: "var(--surface)",
                border: "1px solid var(--grid)",
                color: "var(--muted)",
              }}
            >
              Loading current case snapshot...
            </div>
          ) : caseSnapshotUnavailable ? (
            <div
              style={{
                padding: 40,
                background: "var(--surface)",
                border: "1px solid var(--grid)",
                color: "var(--muted)",
              }}
            >
              The current case snapshot is unavailable because the cases read failed.
            </div>
          ) : cases.length === 0 ? (
            <div
              style={{
                padding: 40,
                background: "var(--surface)",
                border: "1px solid var(--grid)",
                color: "var(--muted)",
              }}
            >
              No persisted cases are present in the current snapshot. Click &quot;+ NEW CASE / SEED
              DEMO&quot; to add one.
            </div>
          ) : visibleCases.length === 0 ? (
            <div
              style={{
                padding: 40,
                background: "var(--surface)",
                border: "1px solid var(--grid)",
                color: "var(--muted)",
              }}
            >
              No persisted cases match the current search and filter combination.
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--forest)" }}>
              <div style={{ overflowX: "auto" }}>
                <div
                  style={{
                    minWidth: 960,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1.2fr 2fr 1.8fr 1fr 1fr",
                      padding: "14px 20px",
                      background: "var(--forest)",
                      color: "var(--lime)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    <div>Case ID</div>
                    <div>Member</div>
                    <div>Procedure</div>
                    <div>Current State</div>
                    <div>Updated</div>
                    <div style={{ textAlign: "right" }}>Action</div>
                  </div>

                  {visibleCases.map((caseRecord) => {
                    const presentation = getStatusPresentation(
                      caseRecord.current_case_status
                    );

                    return (
                      <Link
                        key={caseRecord.id}
                        href={`/dashboard/cases/${caseRecord.case_id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.2fr 1.2fr 2fr 1.8fr 1fr 1fr",
                          padding: "18px 20px",
                          borderBottom: "1px solid var(--grid)",
                          alignItems: "center",
                          textDecoration: "none",
                          color: "var(--ink)",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = "var(--bg)";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "14px" }}>
                          {caseRecord.case_id}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                          {caseRecord.member_id}
                        </div>
                        <div style={{ fontSize: "14px" }}>{caseRecord.planned_procedure}</div>
                        <div>
                          <span
                            style={{
                              background: presentation.badgeBg,
                              color: presentation.badgeText,
                              padding: "4px 10px",
                              fontSize: "10px",
                              fontWeight: 800,
                              letterSpacing: "0.12em",
                              borderRadius: 2,
                              textTransform: "uppercase",
                            }}
                          >
                            ● {presentation.label}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {caseRecord.updated_at}
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "var(--forest)",
                            fontSize: "13px",
                          }}
                        >
                          OPEN →
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--grid)",
            padding: 32,
            marginBottom: 48,
          }}
        >
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
            Coverage Twin Case Lifecycle Architecture
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ borderLeft: "2px solid var(--forest)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>
                01 INTAKE
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Context Normalised
              </div>
            </div>
            <div style={{ borderLeft: "2px solid var(--forest)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--forest)" }}>
                02 PRE-AUTH
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Coverage & Necessity
              </div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>
                03 DISCHARGE
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Outcome Evidence
              </div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>
                04 SETTLEMENT
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Bill Reconciliation
              </div>
            </div>
            <div style={{ borderLeft: "2px solid var(--grid)", paddingLeft: 12 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>
                05 CLOSED
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                Case Record Finalised
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
