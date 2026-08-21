import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { EvidenceReport } from "@/types/workflow";

export async function GET(request: NextRequest) {
  try {
    const caseId = request.nextUrl.searchParams.get("case_id");
    const caseVersionParam = request.nextUrl.searchParams.get("case_version");
    
    if (!caseId || !caseVersionParam) {
      return NextResponse.json(
        { success: false, error: "case_id and case_version are required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const caseVersion = parseInt(caseVersionParam, 10);
    const supabase = await createClient();

    const { data: evidenceReports } = await supabase
      .from("evidence_reports")
      .select("*")
      .eq("case_id", caseId)
      .eq("case_version", caseVersion);

    if (!evidenceReports) {
      return NextResponse.json(
        { success: false, error: "Evidence not found", error_code: "TOOL_FAILURE" },
        { status: 404 }
      );
    }

    const policyReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "policy");
    const clinicalReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "clinical");
    const costReport = evidenceReports.find((r: EvidenceReport) => r.agent_name === "cost_contract");

    return NextResponse.json({
      success: true,
      data: {
        case_id: caseId,
        case_version: caseVersion,
        handoff_status: policyReport && clinicalReport && costReport ? "COMPLETE" : "INCOMPLETE",
        policy_evidence_result: policyReport || null,
        clinical_evidence_result: clinicalReport || null,
        cost_contract_result: costReport || null,
        version_consistency: {
          all_case_ids_match: true,
          all_case_versions_match: true,
          validated_case_version: caseVersion,
        }
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
