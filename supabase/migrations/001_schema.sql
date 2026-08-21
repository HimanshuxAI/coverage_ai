-- ============================================================
-- YOXA Database Schema
-- Planned Cashless Surgery Pre-Authorisation
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Cases (Authoritative Case Registry) ───
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT UNIQUE NOT NULL,
  case_version INTEGER NOT NULL DEFAULT 1,
  patient_consent_status BOOLEAN NOT NULL DEFAULT false,
  patient_consent_timestamp TIMESTAMPTZ,
  hospital_clinical_confirmation_status BOOLEAN NOT NULL DEFAULT false,
  hospital_confirmation_timestamp TIMESTAMPTZ,
  member_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  hospital_id TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  planned_procedure TEXT NOT NULL,
  planned_date DATE NOT NULL,
  evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_provenance TEXT NOT NULL DEFAULT 'UNVERIFIED',
  current_case_status TEXT NOT NULL DEFAULT 'WAITING_FOR_ACTIVATION',
  source_system TEXT NOT NULL DEFAULT 'coverage_twin_case_registry',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit Events (Immutable, Append-Only) ───
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_event_id TEXT UNIQUE NOT NULL,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent updates/deletes on audit_events
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit
  BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER no_delete_audit
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ─── Evidence Reports ───
CREATE TABLE IF NOT EXISTS evidence_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  agent_name TEXT NOT NULL CHECK (agent_name IN ('policy', 'clinical', 'cost_contract')),
  report_status TEXT NOT NULL,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_status TEXT NOT NULL DEFAULT 'SUCCESS',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, case_version, agent_name)
);

-- ─── Resolution Graphs ───
CREATE TABLE IF NOT EXISTS resolution_graphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  graph_id TEXT UNIQUE NOT NULL,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  graph_version INTEGER NOT NULL DEFAULT 1,
  graph_state TEXT NOT NULL,
  dependency_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_authorisation_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_safe_action TEXT NOT NULL,
  source_report_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, graph_version)
);

-- ─── Blocker Actions ───
CREATE TABLE IF NOT EXISTS blocker_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  graph_version INTEGER NOT NULL,
  dependency_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocker_status TEXT NOT NULL,
  owner TEXT,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_safe_action TEXT,
  agent_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Decision Packets ───
CREATE TABLE IF NOT EXISTS decision_packets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packet_id TEXT UNIQUE NOT NULL,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  graph_version INTEGER NOT NULL,
  packet_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Human Decisions ───
CREATE TABLE IF NOT EXISTS human_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  human_decision_id TEXT UNIQUE NOT NULL,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  case_version INTEGER NOT NULL,
  graph_version INTEGER NOT NULL,
  packet_id TEXT NOT NULL REFERENCES decision_packets(packet_id),
  reviewer_identity TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('AUTHORISE', 'REQUEST_CLARIFICATION', 'DECLINE_OR_REDUCE')),
  written_reason TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  authorised_amount NUMERIC,
  currency TEXT,
  validity_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarification_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notifications ───
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  notification_type TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PATIENT', 'HOSPITAL')),
  recipient_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Idempotency Keys ───
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT UNIQUE NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_cases_case_id ON cases(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(current_case_status);
CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_reports(case_id, case_version);
CREATE INDEX IF NOT EXISTS idx_graphs_case ON resolution_graphs(case_id);
CREATE INDEX IF NOT EXISTS idx_decisions_case ON human_decisions(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_case ON notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_idempotency ON idempotency_keys(idempotency_key);

-- Disable Row Level Security (RLS) for all tables to allow the public API routes to seed and update cases
ALTER TABLE cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_graphs DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocker_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE decision_packets DISABLE ROW LEVEL SECURITY;
ALTER TABLE human_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys DISABLE ROW LEVEL SECURITY;

