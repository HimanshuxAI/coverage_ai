/* ======================================================
   YOXA — API: Resolve Evidence in Parallel (Step 2)
   POST /api/workflow/resolve-evidence
   Runs Policy, Clinical, and Cost agents concurrently
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  DEMO_POLICY_EVIDENCE,
  DEMO_CLINICAL_EVIDENCE,
  DEMO_COST_EVIDENCE,
} from "@/lib/workflow/seed-data";
import { generateAuditEventId, generateAgentRunId } from "@/lib/workflow/validators";

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

    // Verify case is ACTIVATED_VALIDATED
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

    if (caseRecord.current_case_status !== "ACTIVATED_VALIDATED") {
      return NextResponse.json(
        {
          success: false,
          error: `Case must be ACTIVATED_VALIDATED, current: ${caseRecord.current_case_status}`,
          error_code: "INVALID_STATE",
        },
        { status: 400 }
      );
    }

    const caseVersion = caseRecord.case_version;

    // Run all three evidence agents in parallel (simulated)
    // In production these would call external APIs; here we use demo data
    const policyEvidence = { ...DEMO_POLICY_EVIDENCE, case_id, case_version: caseVersion };
    const clinicalEvidence = { ...DEMO_CLINICAL_EVIDENCE, case_id, case_version: caseVersion };
    const costEvidence = { ...DEMO_COST_EVIDENCE, case_id, case_version: caseVersion };

    // Insert all three evidence reports concurrently
    const [policyResult, clinicalResult, costResult] = await Promise.all([
      supabase
        .from("evidence_reports")
        .upsert(
          {
            case_id,
            case_version: caseVersion,
            agent_name: "policy",
            report_status: policyEvidence.report_status,
            findings: policyEvidence.findings,
            citations: policyEvidence.citations,
            unresolved_dependencies: policyEvidence.unresolved_dependencies,
            tool_status: policyEvidence.tool_status,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "case_id,case_version,agent_name" }
        )
        .select()
        .single(),
      supabase
        .from("evidence_reports")
        .upsert(
          {
            case_id,
            case_version: caseVersion,
            agent_name: "clinical",
            report_status: clinicalEvidence.report_status,
            findings: clinicalEvidence.findings,
            citations: clinicalEvidence.citations,
            unresolved_dependencies: clinicalEvidence.unresolved_dependencies,
            tool_status: clinicalEvidence.tool_status,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "case_id,case_version,agent_name" }
        )
        .select()
        .single(),
      supabase
        .from("evidence_reports")
        .upsert(
          {
            case_id,
            case_version: caseVersion,
            agent_name: "cost_contract",
            report_status: costEvidence.report_status,
            findings: costEvidence.findings,
            citations: costEvidence.citations,
            unresolved_dependencies: costEvidence.unresolved_dependencies,
            tool_status: costEvidence.tool_status,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "case_id,case_version,agent_name" }
        )
        .select()
        .single(),
    ]);

    // Check all succeeded
    const anyError =
      policyResult.error || clinicalResult.error || costResult.error;

    if (anyError) {
      // Update case to TOOL_FAILURE
      await supabase
        .from("cases")
        .update({ current_case_status: "TOOL_FAILURE", updated_at: new Date().toISOString() })
        .eq("case_id", case_id);

      return NextResponse.json(
        {
          success: false,
          error: "One or more evidence agents failed",
          error_code: "TOOL_FAILURE",
          details: {
            policy: policyResult.error?.message,
            clinical: clinicalResult.error?.message,
            cost: costResult.error?.message,
          },
        },
        { status: 500 }
      );
    }

    // Update case status to EVIDENCE_RESOLVED
    await supabase
      .from("cases")
      .update({
        current_case_status: "EVIDENCE_RESOLVED",
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", case_id);

    // Create audit event
    await supabase.from("audit_events").insert({
      audit_event_id: generateAuditEventId(case_id, "EVIDENCE"),
      case_id,
      case_version: caseVersion,
      event_type: "EVIDENCE_RESOLUTION",
      event_data: {
        policy_status: policyEvidence.report_status,
        clinical_status: clinicalEvidence.report_status,
        cost_status: costEvidence.report_status,
        all_agents_succeeded: true,
      },
      agent_run_id: agentRunId,
    });

    return NextResponse.json({
      success: true,
      data: {
        case_id,
        case_version: caseVersion,
        evidence_count: 3,
        policy_evidence_result: { report_status: policyEvidence.report_status, tool_status: "SUCCESS" },
        clinical_evidence_result: { report_status: clinicalEvidence.report_status, tool_status: "SUCCESS" },
        cost_contract_result: { report_status: costEvidence.report_status, tool_status: "SUCCESS" },
        new_case_status: "EVIDENCE_RESOLVED",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
