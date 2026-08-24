/* ======================================================
   COVERAGE TWIN — Case Process Orchestrator API
   POST /api/cases/:caseId/process
   ====================================================== */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateWorkflowRun, updateWorkflowRunState } from "@/lib/yoxa/runs";
import { triggerYoxaWorkflow } from "@/lib/yoxa/client";
import { parseProcessRequest } from "@/lib/yoxa/process-request";
import {
  assertRequestedWorkflowIsNext,
  caseStatusRequiresResolutionGraph,
} from "@/lib/workflow/next-action";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => null);
    const parsedRequest = parseProcessRequest(body);

    if (!parsedRequest.ok) {
      return NextResponse.json(
        { success: false, error: parsedRequest.error },
        { status: 400 }
      );
    }

    if (!caseId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAM", message: "caseId parameter is required" } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Read current case state
    const { data: caseRecord, error: fetchError } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (fetchError || !caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: "CASE_NOT_FOUND", message: `Case ${caseId} not found` } },
        { status: 404 }
      );
    }

    const { workflowKey } = parsedRequest;
    const requiresResolutionGraph = caseStatusRequiresResolutionGraph(caseRecord.current_case_status);
    let resolutionGraph: { graph_state: string } | null = null;

    if (requiresResolutionGraph) {
      const { data, error: resolutionGraphError } = await supabase
        .from("resolution_graphs")
        .select("graph_state")
        .eq("case_id", caseId)
        .order("graph_version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resolutionGraphError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RESOLUTION_GRAPH_READ_FAILED",
              message: `Failed to read resolution graph for case ${caseId}`,
            },
          },
          { status: 502 }
        );
      }

      resolutionGraph = data;
    }

    const nextWorkflowAssertion = assertRequestedWorkflowIsNext(workflowKey, {
      caseStatus: caseRecord.current_case_status,
      resolutionGraph: resolutionGraph ? { graphState: resolutionGraph.graph_state } : null,
    });

    if (!nextWorkflowAssertion.ok) {
      return NextResponse.json(
        {
          success: false,
          error: nextWorkflowAssertion.error,
        },
        { status: 409 }
      );
    }

    // Get or create persistent workflow run (with duplicate protection)
    const { run, isExisting } = await getOrCreateWorkflowRun(caseId, workflowKey, {
      triggered_by: "api",
      case_status_at_trigger: caseRecord.current_case_status,
    });

    if (isExisting) {
      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: caseRecord.current_case_status,
          message: "Existing active workflow run already in progress",
          workflowRun: run,
        },
      });
    }

    // Mark run as TRIGGERING
    await updateWorkflowRunState(run.id, { status: "TRIGGERING" });

    // Execute Yoxa trigger call
    const triggerResult = await triggerYoxaWorkflow({
      workflowKey,
      idempotencyKey: run.idempotency_key,
      payload: { trigger_text: "Start workflow", case_id: caseId },
    });

    if (triggerResult.success) {
      const updatedRun = await updateWorkflowRunState(run.id, {
        status: "RUNNING",
        raw_response: triggerResult.data || {},
        normalized_output: {
          triggered: true,
          statusCode: triggerResult.statusCode,
          timestamp: new Date().toISOString(),
        },
      });

      // Log immutable audit event
      const auditEventId = `aud_trig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await supabase.from("audit_events").insert({
        audit_event_id: auditEventId,
        case_id: caseId,
        case_version: caseRecord.case_version || 1,
        event_type: `WORKFLOW_TRIGGERED_${workflowKey.toUpperCase()}`,
        event_data: {
          workflow_key: workflowKey,
          idempotency_key: run.idempotency_key,
          status: triggerResult.statusCode,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: caseRecord.current_case_status,
          workflowRun: updatedRun,
        },
      });
    } else {
      const failedRun = await updateWorkflowRunState(run.id, {
        status: "FAILED",
        raw_response: triggerResult.data || {},
        error_code: triggerResult.error?.code || "TRIGGER_FAILED",
        error_message: triggerResult.error?.message || "Failed to trigger Yoxa deployment",
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: triggerResult.error?.code || "TRIGGER_FAILED",
            message: triggerResult.error?.message || "Failed to trigger Yoxa deployment",
          },
          data: {
            workflowRun: failedRun,
          },
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[CaseProcessOrchestrator] Error processing case:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
