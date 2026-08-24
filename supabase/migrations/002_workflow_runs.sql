-- ============================================================
-- YOXA Workflow Runs Table
-- Tracking individual workflow executions, attempts, and idempotency
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  workflow_key TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  yoxa_execution_id TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'TRIGGERING', 'RUNNING', 'WAITING_FOR_HUMAN', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempt INTEGER NOT NULL DEFAULT 1,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_case ON workflow_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_key ON workflow_runs(workflow_key);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

-- RLS settings
ALTER TABLE workflow_runs DISABLE ROW LEVEL SECURITY;
