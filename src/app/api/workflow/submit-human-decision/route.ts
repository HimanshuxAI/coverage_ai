/* ======================================================
   YOXA — API: Submit Human Decision (Step 5b)
   POST /api/workflow/submit-human-decision
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  generateDecisionId,
  generateAuditEventId,
  humanOutcomeIdempotencyKey,
  validateHumanDecision,
  generateAgentRunId,
} from "@/lib/workflow/validators";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { case_id, packet_id } = payload;
    
    if (!case_id || !packet_id) {
      return NextResponse.json(
        { success: false, error: "case_id and packet_id required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const validation = validateHumanDecision(payload);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid decision", errors: validation.errors, error_code: "INVALID_HUMAN_DECISION" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const agentRunId = generateAgentRunId();
    const now = new Date().toISOString();

    // Read case
    const { data: caseRecord } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", case_id)
      .single();

    if (!caseRecord || caseRecord.current_case_status !== "HUMAN_REVIEW_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Case not in human review", error_code: "INVALID_STATE" },
        { status: 400 }
      );
    }

    const caseVersion = caseRecord.case_version;

    // Read latest graph
    const { data: latestGraph } = await supabase
      .from("resolution_graphs")
      .select("graph_version")
      .eq("case_id", case_id)
      .order("graph_version", { ascending: false })
      .limit(1)
      .single();
      
    const graphVersion = latestGraph?.graph_version || 1;

    // Idempotency check
    const idemKey = humanOutcomeIdempotencyKey(case_id, graphVersion, packet_id, payload.decision_timestamp);
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

    // Determine new status
    let newStatus = "AUTHORISED_BY_HUMAN";
    if (payload.outcome === "REQUEST_CLARIFICATION") newStatus = "CLARIFICATION_REQUESTED";
    if (payload.outcome === "DECLINE_OR_REDUCE") newStatus = "DECLINED_OR_REDUCED_BY_HUMAN";
    
    const newCaseVersion = caseVersion + 1;
    const decisionId = generateDecisionId(case_id);
    const auditEventId = generateAuditEventId(case_id, "HUMAN-001");

    // Store human decision
    await supabase.from("human_decisions").insert({
      human_decision_id: decisionId,
      case_id,
      case_version: newCaseVersion,
      graph_version: graphVersion,
      packet_id,
      reviewer_identity: payload.reviewer_identity,
      reviewer_role: payload.reviewer_role,
      outcome: payload.outcome,
      written_reason: payload.written_reason,
      conditions: payload.conditions || [],
      authorised_amount: payload.authorised_amount,
      currency: payload.currency,
      validity_conditions: payload.validity_conditions || [],
      clarification_fields: payload.clarification_fields || [],
      decision_timestamp: payload.decision_timestamp,
      created_at: now,
    });

    // Update case status & version
    await supabase
      .from("cases")
      .update({
        current_case_status: newStatus,
        case_version: newCaseVersion,
        updated_at: now,
      })
      .eq("case_id", case_id)
      .eq("case_version", caseVersion);

    // Create audit event
    await supabase.from("audit_events").insert({
      audit_event_id: auditEventId,
      case_id,
      case_version: newCaseVersion,
      event_type: "HUMAN_DECISION_APPLIED",
      event_data: {
        outcome: payload.outcome,
        reviewer: payload.reviewer_identity,
      },
      agent_run_id: agentRunId,
    });

    const result = {
      persistence_status: "SUCCESS",
      human_decision_id: decisionId,
      case_id,
      previous_case_version: caseVersion,
      new_case_version: newCaseVersion,
      stored_case_status: newStatus,
      outcome: payload.outcome,
      authorised_amount: payload.authorised_amount,
      currency: payload.currency,
      reviewer_identity: payload.reviewer_identity,
      reviewer_role: payload.reviewer_role,
      audit_event_id: auditEventId,
      stored_at: now,
    };

    // Store idempotency
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
