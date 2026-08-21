"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CaseRecord } from "@/types/workflow";
import { getStatusColor, getStatusLabel } from "@/lib/workflow/engine";

export default function Home() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    const { data } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    if (data) setCases(data);
    setLoading(false);
  };

  const seedDemoCase = async () => {
    await fetch("/api/workflow/seed", { method: "POST" });
    fetchCases();
  };

  return (
    <main style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>YOXA Pre-Authorisation</h1>
          <p style={{ color: "var(--text-secondary)", margin: "8px 0 0 0" }}>Planned Cashless Surgery Workflow</p>
        </div>
        <button className="btn-primary" onClick={seedDemoCase}>Seed Demo Case</button>
      </header>

      <div className="glass-panel" style={{ padding: "24px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Active Cases</h2>
        
        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading cases...</p>
        ) : cases.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No cases found. Click "Seed Demo Case" to start.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "12px 8px" }}>Case ID</th>
                <th style={{ padding: "12px 8px" }}>Patient/Member</th>
                <th style={{ padding: "12px 8px" }}>Procedure</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
                <th style={{ padding: "12px 8px" }}>Version</th>
                <th style={{ padding: "12px 8px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "16px 8px", fontWeight: "bold" }}>{c.case_id}</td>
                  <td style={{ padding: "16px 8px" }}>{c.member_id}</td>
                  <td style={{ padding: "16px 8px" }}>{c.planned_procedure}</td>
                  <td style={{ padding: "16px 8px" }}>
                    <span style={{
                      backgroundColor: `${getStatusColor(c.current_case_status)}20`,
                      color: getStatusColor(c.current_case_status),
                      padding: "4px 12px",
                      borderRadius: "100px",
                      fontSize: "0.85rem",
                      fontWeight: 600
                    }}>
                      {getStatusLabel(c.current_case_status)}
                    </span>
                  </td>
                  <td style={{ padding: "16px 8px" }}>v{c.case_version}</td>
                  <td style={{ padding: "16px 8px", color: "var(--text-secondary)" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
