/* ======================================================
   YOXA — API: Build Resolution Graph (Step 3)
   POST /api/workflow/build-resolution-graph
   Reads consolidated evidence and builds versioned graph
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildResolutionGraph } from "@/lib/workflow/graph-builder";
import {
  generateAuditEventId,
  generateGraphId,
  generateAgentRunId,
  resolutionGraphIdempotencyKey,
} from "@/lib/workflow/validators";
import type { EvidenceReport } from "@/types/workflow";

export async function POST(request: NextRequest) {
  try {
    const { case_id } = await request.json();
    if (!case_id) {
      return NextResponse.json(
        { success: false, error: "case_id is required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const agentRunId = generateAgentRunId();

    // Read case
    const { data: caseRecord } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", case_id)
      .single();

    if (!caseRecord) {
      return NextResponse.json(
        { success: false, error: "Case not found", error_code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (caseRecord.current_case_status !== "EVIDENCE_RESOLVED") {
      return NextResponse.json(
        {
          success: false,
          error: `Case must be EVIDENCE_RESOLVED, current: ${caseRecord.current_case_status}`,
          error_code: "INVALID_STATE",
        },
        { status: 400 }
      );
    }

    const caseVersion = caseRecord.case_version;

    // Read consolidated specialist evidence (tool_17_call equivalent)
    const { data: evidenceReports, error: evidenceError } = await supabase
      .from("evidence_reports")
      .select("*")
      .eq("case_id", case_id)
      .eq("case_version", caseVersion);

    if (evidenceError || !evidenceReports || evidenceReports.length < 3) {
      return NextResponse.json(
        { success: false, error: "Consolidated evidence incomplete", error_code: "TOOL_FAILURE" },
        { status: 500 }
      );
    }

    const policyReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "policy");
    const clinicalReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "clinical");
    const costReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "cost_contract");

    if (!policyReport || !clinicalReport || !costReport) {
      return NextResponse.json(
        { success: false, error: "Missing specialist report", error_code: "TOOL_FAILURE" },
        { status: 500 }
      );
    }

    // Build the resolution graph
    const graphResult = buildResolutionGraph({
      case_id,
      case_version: caseVersion,
      policy_evidence: policyReport as unknown as EvidenceReport,
      clinical_evidence: clinicalReport as unknown as EvidenceReport,
      cost_contract_evidence: costReport as unknown as EvidenceReport,
    });

    // Check idempotency
    const reportVersionsStr = JSON.stringify(graphResult.source_report_versions);
    const idemKey = resolutionGraphIdempotencyKey(case_id, caseVersion, reportVersionsStr);
    const { data: existingIdem } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("idempotency_key", idemKey)
      .single();

    if (existingIdem) {
      return NextResponse.json({
        success: true,
        data: { ...existingIdem.result, idempotency_result: "ALREADY_EXISTS" },
      });
    }

    // Get next graph version
    const { data: latestGraph } = await supabase
      .from("resolution_graphs")
      .select("graph_version")
      .eq("case_id", case_id)
      .order("graph_version", { ascending: false })
      .limit(1)
      .single();

    const graphVersion = latestGraph ? latestGraph.graph_version + 1 : 1;
    const graphId = generateGraphId(case_id);
    const auditEventId = generateAuditEventId(case_id, `GRAPH-${String(graphVersion).padStart(3, "0")}`);
    const now = new Date().toISOString();

    // Persist graph
    const { error: graphError } = await supabase.from("resolution_graphs").insert({
      graph_id: `${graphId}-v${graphVersion}`,
      case_id,
      case_version: caseVersion,
      graph_version: graphVersion,
      graph_state: graphResult.graph_state,
      dependency_nodes: graphResult.dependency_nodes,
      unresolved_dependencies: graphResult.unresolved_dependencies,
      post_authorisation_conditions: graphResult.post_authorisation_conditions,
      state_reason_codes: graphResult.state_reason_codes,
      next_safe_action: graphResult.next_safe_action,
      source_report_versions: graphResult.source_report_versions,
      created_at: now,
    });

    if (graphError) {
      return NextResponse.json(
        { success: false, error: graphError.message, error_code: "REGISTRY_WRITE_FAILED" },
        { status: 500 }
      );
    }

    // Update case status based on graph state
    let newCaseStatus = caseRecord.current_case_status;
    if (graphResult.graph_state === "DECISION_READY") {
      newCaseStatus = "DECISION_READY";
    } else if (graphResult.graph_state === "HUMAN_AMBIGUITY") {
      newCaseStatus = "HUMAN_AMBIGUITY";
    } else if (graphResult.graph_state === "TOOL_FAILURE") {
      newCaseStatus = "TOOL_FAILURE";
    }

    await supabase
      .from("cases")
      .update({ current_case_status: newCaseStatus, updated_at: now })
      .eq("case_id", case_id);

    // Audit event
    await supabase.from("audit_events").insert({
      audit_event_id: auditEventId,
      case_id,
      case_version: caseVersion,
      event_type: "RESOLUTION_GRAPH_BUILT",
      event_data: {
        graph_version: graphVersion,
        graph_state: graphResult.graph_state,
        dependency_count: graphResult.dependency_nodes.length,
        unresolved_count: graphResult.unresolved_dependencies.length,
        post_auth_conditions: graphResult.post_authorisation_conditions,
      },
      agent_run_id: agentRunId,
    });

    // Store idempotency
    const result = {
      persistence_status: "SUCCESS",
      graph_id: `${graphId}-v${graphVersion}`,
      graph_version: graphVersion,
      graph_state: graphResult.graph_state,
      dependency_count: graphResult.dependency_nodes.length,
      unresolved_dependencies: graphResult.unresolved_dependencies,
      post_authorisation_conditions: graphResult.post_authorisation_conditions,
      next_safe_action: graphResult.next_safe_action,
      audit_event_id: auditEventId,
      stored_at: now,
    };

    await supabase.from("idempotency_keys").insert({ idempotency_key: idemKey, result });

    return NextResponse.json({
      success: true,
      data: { ...result, idempotency_result: "CREATED" },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
