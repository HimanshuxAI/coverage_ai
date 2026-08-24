/* ======================================================
   YOXA — External Human Approval Webhook Receiver
   POST /api/yoxa/approvals/webhook
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = { raw: rawBody };
    }

    const signature = request.headers.get("x-yoxa-signature") || request.headers.get("x-signature") || "";
    const caseId = (body.case_id as string) || (body.caseId as string) || "CASE-CT-REAL-001";
    const approvalId = (body.approval_id as string) || (body.id as string) || `appr_${Date.now()}`;

    console.log(`[ApprovalWebhook] Received approval request approvalId=${approvalId} caseId=${caseId} signature=${signature ? "PRESENT" : "NONE"}`);

    const supabase = await createClient();

    // Check case
    const { data: caseRecord } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (caseRecord) {
      // Update case status to HUMAN_REVIEW_REQUIRED
      await supabase
        .from("cases")
        .update({
          current_case_status: "HUMAN_REVIEW_REQUIRED",
          updated_at: new Date().toISOString(),
        })
        .eq("case_id", caseId);

      // Audit log
      const auditEventId = `aud_appr_req_${Date.now()}`;
      await supabase.from("audit_events").insert({
        audit_event_id: auditEventId,
        case_id: caseId,
        case_version: caseRecord.case_version || 1,
        event_type: "HUMAN_APPROVAL_REQUESTED",
        event_data: {
          approval_id: approvalId,
          payload: body,
          signature_present: Boolean(signature),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Human approval request received and registered",
      approvalId,
      caseId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[ApprovalWebhook] Error handling webhook:", error);
    return NextResponse.json(
      { success: false, error: { code: "WEBHOOK_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
