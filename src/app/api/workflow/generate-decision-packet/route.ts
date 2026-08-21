/* ======================================================
   YOXA — API: Generate Decision-Ready Packet (Step 5a)
   POST /api/workflow/generate-decision-packet
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generatePacketId } from "@/lib/workflow/validators";

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
    const now = new Date().toISOString();

    // Read case
    const { data: caseRecord } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", case_id)
      .single();

    if (!caseRecord || caseRecord.current_case_status !== "DECISION_READY") {
      return NextResponse.json(
        { success: false, error: "Case is not DECISION_READY", error_code: "INVALID_STATE" },
        { status: 400 }
      );
    }

    // Read latest graph
    const { data: latestGraph } = await supabase
      .from("resolution_graphs")
      .select("*")
      .eq("case_id", case_id)
      .order("graph_version", { ascending: false })
      .limit(1)
      .single();

    if (!latestGraph || latestGraph.unresolved_dependencies.length > 0) {
      return NextResponse.json(
        { success: false, error: "Graph is not decision ready", error_code: "GRAPH_NOT_READY" },
        { status: 400 }
      );
    }

    // Read evidence
    const { data: evidenceReports } = await supabase
      .from("evidence_reports")
      .select("*")
      .eq("case_id", case_id)
      .eq("case_version", caseRecord.case_version);

    // In a full implementation, we'd generate a PDF here using @react-pdf/renderer
    // For now, we store packet metadata
    const packetId = generatePacketId(case_id);
    
    // Store packet
    await supabase.from("decision_packets").insert({
      packet_id: packetId,
      case_id,
      case_version: caseRecord.case_version,
      graph_version: latestGraph.graph_version,
      packet_data: {
        evidence: evidenceReports,
        graph: latestGraph,
      },
      generated_at: now,
    });

    // Update case to HUMAN_REVIEW_REQUIRED
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
        packet_id: packetId,
        case_id,
        graph_version: latestGraph.graph_version,
        generated_at: now,
        new_case_status: "HUMAN_REVIEW_REQUIRED",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
