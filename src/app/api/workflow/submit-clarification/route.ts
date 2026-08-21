import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateAgentRunId, generateAuditEventId } from "@/lib/workflow/validators";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { case_id, resolved_dependencies, reviewer_identity, outcome, written_reason } = payload;
    
    if (!case_id || !reviewer_identity || !outcome) {
      return NextResponse.json(
        { success: false, error: "case_id, reviewer_identity, and outcome are required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const agentRunId = generateAgentRunId();
    const now = new Date().toISOString();

    const { data: latestGraph } = await supabase
      .from("resolution_graphs")
      .select("*")
      .eq("case_id", case_id)
      .order("graph_version", { ascending: false })
      .limit(1)
      .single();
      
    if (!latestGraph) {
      return NextResponse.json(
        { success: false, error: "No resolution graph found", error_code: "GRAPH_NOT_FOUND" },
        { status: 404 }
      );
    }

    const newGraphVersion = latestGraph.graph_version + 1;

    // Resolve dependencies provided
    const newUnresolved = latestGraph.unresolved_dependencies.filter(
      (dep: string) => !(resolved_dependencies || []).includes(dep)
    );

    const newGraphState = newUnresolved.length === 0 ? "DECISION_READY" : latestGraph.graph_state;

    // Persist new graph
    await supabase.from("resolution_graphs").insert({
      graph_id: `${latestGraph.graph_id.split('-v')[0]}-v${newGraphVersion}`,
      case_id,
      case_version: latestGraph.case_version,
      graph_version: newGraphVersion,
      graph_state: newGraphState,
      dependency_nodes: latestGraph.dependency_nodes,
      unresolved_dependencies: newUnresolved,
      post_authorisation_conditions: latestGraph.post_authorisation_conditions,
      state_reason_codes: ["HUMAN_CLARIFICATION_APPLIED"],
      next_safe_action: newGraphState === "DECISION_READY" ? "GENERATE_DECISION_PACKET" : latestGraph.next_safe_action,
      source_report_versions: latestGraph.source_report_versions,
      created_at: now,
    });

    // Update blocker status
    await supabase.from("blocker_actions").insert({
      case_id,
      case_version: latestGraph.case_version,
      graph_version: newGraphVersion,
      dependency_ids: resolved_dependencies || [],
      blocker_status: "RESOLVED",
      owner: reviewer_identity,
      reason_codes: ["CLARIFICATION_RESOLVED"],
      next_safe_action: newGraphState === "DECISION_READY" ? "GENERATE_DECISION_PACKET" : "CONTINUE_RESOLUTION",
      agent_run_id: agentRunId,
      created_at: now,
    });

    if (newGraphState === "DECISION_READY") {
      await supabase
        .from("cases")
        .update({ current_case_status: "DECISION_READY", updated_at: now })
        .eq("case_id", case_id);
    }

    const auditEventId = generateAuditEventId(case_id, "GRAPH-RECONCILED");

    return NextResponse.json({
      success: true,
      data: {
        persistence_status: "SUCCESS",
        case_id,
        previous_graph_version: latestGraph.graph_version,
        graph_version: newGraphVersion,
        graph_state: newGraphState,
        resolved_dependencies: resolved_dependencies || [],
        post_authorisation_conditions: latestGraph.post_authorisation_conditions,
        unresolved_dependencies: newUnresolved,
        human_clarification_applied: true,
        audit_event_id: auditEventId,
        idempotency_result: "CREATED",
        stored_at: now,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
