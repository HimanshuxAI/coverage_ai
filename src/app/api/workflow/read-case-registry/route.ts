/* ======================================================
   YOXA — API: Read Case Registry
   GET /api/workflow/read-case-registry?case_id=CASE-CT-0001
   Tool: read_case_registry
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const caseId = request.nextUrl.searchParams.get("case_id");
    if (!caseId) {
      return NextResponse.json(
        { success: false, error: "case_id is required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Case not found", error_code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch audit history
    const { data: auditHistory } = await supabase
      .from("audit_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        audit_history: auditHistory || [],
        source_system: data.source_system || "coverage_twin_case_registry",
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "REGISTRY_UNAVAILABLE" },
      { status: 500 }
    );
  }
}
