/* ======================================================
   YOXA — API: Validate Activated Case (Step 1)
   POST /api/workflow/validate-activation
   Tools: read_case_registry + update_case_registry_validation
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  validateActivation,
  activationIdempotencyKey,
  generateAuditEventId,
  generateAgentRunId,
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

    // Step 1: Read the case
    const { data: caseRecord, error: readError } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", case_id)
      .single();

    if (readError || !caseRecord) {
      return NextResponse.json(
        { success: false, error: "Case not found", error_code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Step 2: Check idempotency
    const idemKey = activationIdempotencyKey(case_id, caseRecord.case_version);
    const { data: existingIdem } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("idempotency_key", idemKey)
      .single();

    if (existingIdem) {
      return NextResponse.json({
        success: true,
        data: {
          ...existingIdem.result,
          idempotency_result: "ALREADY_EXISTS",
        },
      });
    }

    // Step 3: Validate activation
    const validation = validateActivation(caseRecord);
    const newVersion = caseRecord.case_version + 1;
    const auditEventId = generateAuditEventId(case_id, "VALIDATION");
    const now = new Date().toISOString();

    // Step 4: Update the case
    const { error: updateError } = await supabase
      .from("cases")
      .update({
        current_case_status: validation.status,
        case_version: newVersion,
        updated_at: now,
      })
      .eq("case_id", case_id)
      .eq("case_version", caseRecord.case_version);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Version conflict or write failed", error_code: "VERSION_CONFLICT" },
        { status: 409 }
      );
    }

    // Step 5: Create audit event
    await supabase.from("audit_events").insert({
      audit_event_id: auditEventId,
      case_id: case_id,
      case_version: newVersion,
      event_type: "ACTIVATION_VALIDATION",
      event_data: {
        validation_status: validation.status,
        verified_fields: validation.verified_fields,
        missing_fields: validation.missing_fields,
        conflicts: validation.conflicts,
        reason_codes: validation.reason_codes,
        next_safe_action: validation.isValid ? "RESOLVE_EVIDENCE" : "WAIT_OR_REVIEW",
      },
      agent_run_id: agentRunId,
    });

    // Step 6: Store idempotency key
    const result = {
      case_id,
      stored_status: validation.status,
      new_case_version: newVersion,
      audit_event_id: auditEventId,
      validated_at: now,
    };

    await supabase.from("idempotency_keys").insert({
      idempotency_key: idemKey,
      result,
    });

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
