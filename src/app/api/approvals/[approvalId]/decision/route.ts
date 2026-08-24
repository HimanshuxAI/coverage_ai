/* ======================================================
   COVERAGE TWIN — Human Decision Endpoint
   POST /api/approvals/:approvalId/decision
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { approvalId } = await params;
    const body = await request.json();

    const {
      caseId,
      outcome, // "AUTHORISE" | "REQUEST_CLARIFICATION" | "DECLINE_OR_REDUCE"
      writtenReason,
      reviewerIdentity = "Medical Auditor",
      reviewerRole = "Auditor",
      authorisedAmount = null,
    } = body;

    if (!caseId || !outcome || !writtenReason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_PARAM", message: "caseId, outcome, and writtenReason are required" },
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify case
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

    // Determine new case status
    let newStatus = caseRecord.current_case_status;
    if (outcome === "AUTHORISE") {
      newStatus = "AUTHORISED_BY_HUMAN";
    } else if (outcome === "DECLINE_OR_REDUCE") {
      newStatus = "DECLINED_OR_REDUCED_BY_HUMAN";
    } else if (outcome === "REQUEST_CLARIFICATION") {
      newStatus = "CLARIFICATION_REQUESTED";
    }

    // Ensure decision packet exists for FK constraint
    const packetId = `PKT-${caseId}-V${caseRecord.case_version || 1}`;
    const { data: existingPacket } = await supabase
      .from("decision_packets")
      .select("packet_id")
      .eq("packet_id", packetId)
      .single();

    if (!existingPacket) {
      await supabase.from("decision_packets").insert({
        packet_id: packetId,
        case_id: caseId,
        case_version: caseRecord.case_version || 1,
        graph_version: 1,
        packet_data: {
          generated_by: "system_human_decision_flow",
          authorised_amount: authorisedAmount,
          currency: "INR",
        },
      });
    }

    // Store Human Decision record
    const humanDecisionId = `DEC-${caseId}-${uuidv4().substring(0, 8)}`;

    const { data: insertedDecision, error: insertError } = await supabase
      .from("human_decisions")
      .insert({
        human_decision_id: humanDecisionId,
        case_id: caseId,
        case_version: caseRecord.case_version || 1,
        graph_version: 1,
        packet_id: packetId,
        reviewer_identity: reviewerIdentity,
        reviewer_role: reviewerRole,
        outcome,
        written_reason: writtenReason,
        authorised_amount: outcome === "AUTHORISE" ? (authorisedAmount || null) : 0,
        currency: "INR",
        decision_timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[HumanDecisionAPI] Error storing decision:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // Update case status in database
    await supabase
      .from("cases")
      .update({
        current_case_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseId);

    // Update active workflow runs to COMPLETED
    await supabase
      .from("workflow_runs")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        normalized_output: {
          human_outcome: outcome,
          authorised_amount: authorisedAmount,
          reviewed_by: reviewerIdentity,
        },
      })
      .eq("case_id", caseId)
      .in("status", ["RUNNING", "WAITING_FOR_HUMAN"]);

    // Insert audit event
    await supabase.from("audit_events").insert({
      audit_event_id: `AUD-${caseId}-DEC-${Date.now()}`,
      case_id: caseId,
      case_version: caseRecord.case_version || 1,
      event_type: `HUMAN_DECISION_${outcome}`,
      event_data: {
        approval_id: approvalId,
        human_decision_id: humanDecisionId,
        outcome,
        written_reason: writtenReason,
        authorised_amount: authorisedAmount,
        reviewer: reviewerIdentity,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        caseId,
        newStatus,
        decision: insertedDecision,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[HumanDecisionAPI] Error processing decision:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
