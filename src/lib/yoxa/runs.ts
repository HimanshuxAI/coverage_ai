/* ======================================================
   YOXA — Canonical Workflow Runs Persistence Repository
   Direct, authoritative persistence in Supabase workflow_runs table.
   Strict Invariant: No workflow_runs row => No Yoxa trigger.
   Zero synthetic fallback data. Zero time-based auto-completion.
   ====================================================== */

import { createClient } from "@/utils/supabase/server";
import { getWorkflowDefinition } from "./registry";
import type { YoxaWorkflowKey, WorkflowRunRecord, WorkflowRunStatus } from "./types";
import { v4 as uuidv4 } from "uuid";

export async function getOrCreateWorkflowRun(
  caseId: string,
  workflowKey: YoxaWorkflowKey,
  inputPayload: Record<string, unknown> = {}
): Promise<{ run: WorkflowRunRecord; isExisting: boolean }> {
  const supabase = await createClient();
  const def = getWorkflowDefinition(workflowKey);

  // 1. Query Supabase workflow_runs table for active runs
  const { data: existingRuns, error: queryError } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("case_id", caseId)
    .eq("workflow_key", workflowKey)
    .in("status", ["TRIGGERING", "RUNNING", "WAITING_FOR_HUMAN"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (queryError) {
    console.error("[WorkflowRuns] Query error checking active runs:", queryError);
    throw new Error(`WORKFLOW_RUN_QUERY_FAILED: ${queryError.message}`);
  }

  if (existingRuns && existingRuns.length > 0) {
    const existing = existingRuns[0] as WorkflowRunRecord;
    console.log(`[WorkflowRuns] Active run found in DB id=${existing.id} status=${existing.status}`);
    return { run: existing, isExisting: true };
  }

  // 2. Create canonical workflow run record in Supabase
  const runId = uuidv4();
  const idempotencyKey = `wf_${workflowKey}_${caseId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  const newRunPayload = {
    id: runId,
    case_id: caseId,
    workflow_key: workflowKey,
    workflow_name: def.name,
    yoxa_execution_id: null,
    idempotency_key: idempotencyKey,
    status: "QUEUED",
    attempt: 1,
    input_payload: inputPayload,
    raw_response: {},
    normalized_output: {},
    error_code: null,
    error_message: null,
    queued_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("workflow_runs")
    .insert(newRunPayload)
    .select()
    .single();

  if (insertError || !inserted) {
    console.error("[WorkflowRuns] Mandatory canonical insert failed:", insertError);
    throw new Error(`WORKFLOW_RUN_PERSISTENCE_FAILED: ${insertError?.message || "Insert failed"}`);
  }

  console.log(`[WorkflowRuns] Created canonical workflow_runs row id=${inserted.id} idempotencyKey=${idempotencyKey}`);
  return { run: inserted as WorkflowRunRecord, isExisting: false };
}

export async function updateWorkflowRunState(
  runId: string,
  updates: {
    status?: WorkflowRunStatus;
    raw_response?: Record<string, unknown>;
    normalized_output?: Record<string, unknown>;
    error_code?: string;
    error_message?: string;
    yoxa_execution_id?: string;
  }
): Promise<WorkflowRunRecord> {
  const supabase = await createClient();

  // Normalize Yoxa execution ID from raw response if not explicitly passed
  let yoxaExecutionId = updates.yoxa_execution_id;
  const rawResponseBody =
    updates.raw_response && typeof updates.raw_response.body === "object" && updates.raw_response.body !== null
      ? (updates.raw_response.body as Record<string, unknown>)
      : updates.raw_response;
  if (!yoxaExecutionId && rawResponseBody && typeof rawResponseBody.workflow_run_id === "string") {
    yoxaExecutionId = rawResponseBody.workflow_run_id;
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...updates,
  };

  if (yoxaExecutionId) {
    patch.yoxa_execution_id = yoxaExecutionId;
  }

  if (updates.status === "TRIGGERING") {
    patch.started_at = new Date().toISOString();
  } else if (updates.status === "COMPLETED") {
    patch.completed_at = new Date().toISOString();
  } else if (updates.status === "FAILED") {
    patch.failed_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("workflow_runs")
    .update(patch)
    .eq("id", runId)
    .select()
    .single();

  if (error || !updated) {
    console.error(`[WorkflowRuns] Error updating workflow_runs row id=${runId}:`, error);
    throw new Error(`WORKFLOW_RUN_PERSISTENCE_FAILED: ${error?.message || "Update failed"}`);
  }

  console.log(`[WorkflowRuns] Updated workflow_runs row id=${runId} status=${updated.status} yoxa_execution_id=${updated.yoxa_execution_id}`);
  return updated as WorkflowRunRecord;
}
