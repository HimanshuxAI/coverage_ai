/* ======================================================
   YOXA — API: Seed Demo Case
   POST /api/workflow/seed
   ====================================================== */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  DEMO_AUDIT_EVENTS,
  DEMO_CASE,
  DEMO_DECISION_PACKET,
  DEMO_EVIDENCE_REPORTS,
  DEMO_HUMAN_DECISION,
  DEMO_RESOLUTION_GRAPH,
  DEMO_WORKFLOW_RUNS,
} from "@/lib/workflow/seed-data";

interface SeedWriteResult {
  error: unknown | null;
}

function getSeedErrorMessage(error: unknown): string {
  if (!error) {
    return "Unknown seed write failure";
  }

  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

function isMissingColumnError(error: unknown, column: string): boolean {
  return getSeedErrorMessage(error).includes(`'${column}' column`);
}

async function assertSeedWrite(label: string, write: PromiseLike<SeedWriteResult>) {
  const { error } = await write;

  if (error) {
    throw new Error(`${label}: ${getSeedErrorMessage(error)}`);
  }
}

async function upsertDemoResolutionGraph(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const result = await supabase.from("resolution_graphs").upsert([DEMO_RESOLUTION_GRAPH], {
    onConflict: "case_id,graph_version",
  });

  if (!result.error) {
    return true;
  }

  if (!isMissingColumnError(result.error, "graph_id")) {
    throw new Error(`resolution_graphs: ${getSeedErrorMessage(result.error)}`);
  }

  const legacyResolutionGraph: Record<string, unknown> = { ...DEMO_RESOLUTION_GRAPH };
  delete legacyResolutionGraph.graph_id;
  const legacyResult = await supabase.from("resolution_graphs").upsert([legacyResolutionGraph], {
    onConflict: "case_id,graph_version",
  });

  if (!legacyResult.error) {
    return true;
  }

  if (isMissingColumnError(legacyResult.error, "graph_state")) {
    return false;
  }

  throw new Error(`resolution_graphs: ${getSeedErrorMessage(legacyResult.error)}`);
}

export async function POST() {
  try {
    const supabase = await createClient();

    const { data, error: caseError } = await supabase
      .from("cases")
      .upsert(DEMO_CASE, { onConflict: "case_id" })
      .select("case_id")
      .single();

    if (caseError) {
      throw new Error(`cases: ${getSeedErrorMessage(caseError)}`);
    }

    await assertSeedWrite(
      "evidence_reports",
      supabase.from("evidence_reports").upsert([...DEMO_EVIDENCE_REPORTS], {
        onConflict: "case_id,case_version,agent_name",
      })
    );
    const storedResolutionGraph = await upsertDemoResolutionGraph(supabase);
    await assertSeedWrite(
      "decision_packets",
      supabase.from("decision_packets").upsert([DEMO_DECISION_PACKET], {
        onConflict: "packet_id",
      })
    );
    await assertSeedWrite(
      "human_decisions",
      supabase.from("human_decisions").upsert([DEMO_HUMAN_DECISION], {
        onConflict: "human_decision_id",
      })
    );
    await assertSeedWrite(
      "workflow_runs",
      supabase.from("workflow_runs").upsert([...DEMO_WORKFLOW_RUNS], {
        onConflict: "idempotency_key",
      })
    );

    const demoAuditIds = DEMO_AUDIT_EVENTS.map((auditEvent) => auditEvent.audit_event_id);
    const { data: existingAuditEvents, error: auditReadError } = await supabase
      .from("audit_events")
      .select("audit_event_id")
      .in("audit_event_id", demoAuditIds);

    if (auditReadError) {
      throw new Error(`audit_events read: ${getSeedErrorMessage(auditReadError)}`);
    }

    const existingAuditIds = new Set(
      (existingAuditEvents ?? []).map((auditEvent) => auditEvent.audit_event_id)
    );
    const missingAuditEvents = DEMO_AUDIT_EVENTS.filter(
      (auditEvent) => !existingAuditIds.has(auditEvent.audit_event_id)
    );

    if (missingAuditEvents.length > 0) {
      await assertSeedWrite("audit_events", supabase.from("audit_events").insert([...missingAuditEvents]));
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Full demo case seeded",
        case_id: data.case_id,
        seeded: {
          evidenceReports: DEMO_EVIDENCE_REPORTS.length,
          resolutionGraphs: storedResolutionGraph ? 1 : 0,
          synthesizedResolutionGraph: !storedResolutionGraph,
          decisionPackets: 1,
          humanDecisions: 1,
          workflowRuns: DEMO_WORKFLOW_RUNS.length,
          auditEventsInserted: missingAuditEvents.length,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "SEED_ERROR" },
      { status: 500 }
    );
  }
}
