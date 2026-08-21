/* ======================================================
   YOXA — API: Resolve Blockers (Step 4)
   POST /api/workflow/resolve-blockers
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  generateAuditEventId,
  generateAgentRunId,
  blockerIdempotencyKey,
} from "@/lib/workflow/validators";

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

    // Read latest resolution graph
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

    const graphState = latestGraph.graph_state;
    const now = new Date().toISOString();

    // If DECISION_READY, no blockers to resolve
    if (graphState === "DECISION_READY") {
      const idemKey = blockerIdempotencyKey(
        case_id,
        latestGraph.graph_version,
        [],
        "NO_BLOCKER_ACTION_REQUIRED"
      );

      // Check idempotency
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

      // Record no-blocker action
      await supabase.from("blocker_actions").insert({
        case_id,
        case_version: caseRecord.case_version,
        graph_version: latestGraph.graph_version,
        dependency_ids: [],
        blocker_status: "NO_BLOCKER_ACTION_REQUIRED",
        owner: "SYSTEM",
        reason_codes: ["ALL_DEPENDENCIES_RESOLVED"],
        next_safe_action: "GENERATE_DECISION_PACKET_AND_REQUEST_HUMAN_DECISION",
        agent_run_id: agentRunId,
      });

      const auditEventId = generateAuditEventId(case_id, "BLOCKER-NONE");
      await supabase.from("audit_events").insert({
        audit_event_id: auditEventId,
        case_id,
        case_version: caseRecord.case_version,
        event_type: "BLOCKER_RESOLUTION",
        event_data: {
          graph_version: latestGraph.graph_version,
          blocker_status: "NO_BLOCKER_ACTION_REQUIRED",
          graph_state: "DECISION_READY",
        },
        agent_run_id: agentRunId,
      });

      const result = {
        case_id,
        graph_version: latestGraph.graph_version,
        stored_status: "NO_BLOCKER_ACTION_REQUIRED",
        graph_state: "DECISION_READY",
        unresolved_dependencies: [],
        next_safe_action: "GENERATE_DECISION_PACKET_AND_REQUEST_HUMAN_DECISION",
        audit_event_id: auditEventId,
        stored_at: now,
      };

      await supabase.from("idempotency_keys").insert({ idempotency_key: idemKey, result });

      return NextResponse.json({
        success: true,
        data: { ...result, idempotency_result: "CREATED" },
      });
    }

    // If HUMAN_AMBIGUITY, route for human clarification
    if (graphState === "HUMAN_AMBIGUITY") {
      await supabase
        .from("cases")
        .update({
          current_case_status: "HUMAN_REVIEW_REQUIRED",
          updated_at: now,
        })
        .eq("case_id", case_id);

      return NextResponse.json({
        success: true,
        data: {
          case_id,
          graph_version: latestGraph.graph_version,
          stored_status: "HUMAN_CLARIFICATION_REQUIRED",
          graph_state: "HUMAN_AMBIGUITY",
          unresolved_dependencies: latestGraph.unresolved_dependencies,
          next_safe_action: "ROUTE_HUMAN_CLARIFICATION",
          stored_at: now,
        },
      });
    }

    // If RESOLVABLE_MISSING_EVIDENCE
    if (graphState === "RESOLVABLE_MISSING_EVIDENCE") {
      await supabase.from("blocker_actions").insert({
        case_id,
        case_version: caseRecord.case_version,
        graph_version: latestGraph.graph_version,
        dependency_ids: latestGraph.unresolved_dependencies,
        blocker_status: "EVIDENCE_REQUESTED",
        owner: "HOSPITAL",
        reason_codes: ["MINIMUM_EVIDENCE_REQUESTED"],
        next_safe_action: "WAIT_FOR_EVIDENCE",
        agent_run_id: agentRunId,
      });

      await supabase
        .from("cases")
        .update({ current_case_status: "WAITING_FOR_EVIDENCE", updated_at: now })
        .eq("case_id", case_id);

      return NextResponse.json({
        success: true,
        data: {
          case_id,
          graph_version: latestGraph.graph_version,
          stored_status: "EVIDENCE_REQUESTED",
          unresolved_dependencies: latestGraph.unresolved_dependencies,
          next_safe_action: "WAIT_FOR_EVIDENCE",
          stored_at: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        case_id,
        graph_version: latestGraph.graph_version,
        graph_state: graphState,
        message: "No actionable blocker resolution for current state",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
