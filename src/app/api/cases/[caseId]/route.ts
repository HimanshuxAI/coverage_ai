/* ======================================================
   COVERAGE TWIN — Aggregated Case Command Center API
   GET /api/cases/:caseId
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { AggregateReadError, buildCaseAggregate } from "@/lib/cases/aggregate";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    if (!caseId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAM", message: "caseId is required" } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch case record
    const { data: caseRecord, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (caseError || !caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: "CASE_NOT_FOUND", message: `Case ${caseId} not found` } },
        { status: 404 }
      );
    }

    // Fetch related records in parallel
    const [
      workflowRuns,
      evidenceReports,
      resolutionGraphs,
      humanDecisions,
      decisionPackets,
      auditEvents,
    ] = await Promise.all([
      supabase.from("workflow_runs").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("evidence_reports").select("*").eq("case_id", caseId),
      supabase.from("resolution_graphs").select("*").eq("case_id", caseId).order("graph_version", { ascending: false }),
      supabase.from("human_decisions").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("decision_packets").select("*").eq("case_id", caseId).order("generated_at", { ascending: false }),
      supabase.from("audit_events").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    ]);

    return NextResponse.json(
      buildCaseAggregate({
        caseRecord,
        workflowRuns,
        evidenceReports,
        resolutionGraphs,
        humanDecisions,
        decisionPackets,
        auditEvents,
      })
    );
  } catch (err: unknown) {
    if (err instanceof AggregateReadError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            sources: err.sources,
          },
        },
        { status: 502 }
      );
    }

    const error = err as Error;
    console.error("[AggregatedCaseAPI] Error fetching case:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
