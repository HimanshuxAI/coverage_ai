/* ======================================================
   YOXA — Integration Types
   ====================================================== */

export const YOXA_WORKFLOW_KEYS = [
  "intake",
  "preauth",
  "materialChange",
  "discharge",
  "settlement",
  "appeal",
] as const;

export type YoxaWorkflowKey = (typeof YOXA_WORKFLOW_KEYS)[number];

export type WorkflowRunStatus =
  | "QUEUED"
  | "TRIGGERING"
  | "RUNNING"
  | "WAITING_FOR_HUMAN"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface YoxaWorkflowDefinition {
  key: YoxaWorkflowKey;
  name: string;
  triggerUrl: string;
  secret: string;
}

export interface YoxaTriggerRequest {
  workflowKey: YoxaWorkflowKey;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}

export interface YoxaTriggerResponse {
  success: boolean;
  statusCode: number;
  data?: Record<string, unknown>;
  error?: {
    category?: string;
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  rawBody?: string;
}

export interface WorkflowRunRecord {
  id: string;
  case_id: string;
  workflow_key: YoxaWorkflowKey;
  workflow_name: string;
  yoxa_execution_id: string | null;
  idempotency_key: string;
  status: WorkflowRunStatus;
  attempt: number;
  input_payload: Record<string, unknown>;
  raw_response: Record<string, unknown>;
  normalized_output: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}
