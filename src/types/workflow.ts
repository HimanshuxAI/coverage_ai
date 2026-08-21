/* ======================================================
   YOXA — Workflow Types
   Planned Cashless Surgery Pre-Authorisation
   ====================================================== */

// ─── Case Status (traceable states) ───
export type CaseStatus =
  | "WAITING_FOR_ACTIVATION"
  | "ACTIVATED_VALIDATED"
  | "WAITING_FOR_EVIDENCE"
  | "EVIDENCE_RESOLVED"
  | "DECISION_READY"
  | "HUMAN_REVIEW_REQUIRED"
  | "HUMAN_AMBIGUITY"
  | "AUTHORISED_BY_HUMAN"
  | "CLARIFICATION_REQUESTED"
  | "DECLINED_OR_REDUCED_BY_HUMAN"
  | "TOOL_FAILURE";

export type GraphState =
  | "WAITING_FOR_ACTIVATION"
  | "TOOL_FAILURE"
  | "HUMAN_AMBIGUITY"
  | "RESOLVABLE_MISSING_EVIDENCE"
  | "DECISION_READY";

export type HumanOutcome =
  | "AUTHORISE"
  | "REQUEST_CLARIFICATION"
  | "DECLINE_OR_REDUCE";

export type ClarificationResolution =
  | "RESOLVED_SUPPORTED"
  | "RESOLVED_NOT_SUPPORTED"
  | "REQUEST_MORE_EVIDENCE";

export type BlockerStatus =
  | "NO_BLOCKER_ACTION_REQUIRED"
  | "EVIDENCE_REQUESTED"
  | "HUMAN_CLARIFICATION_REQUIRED"
  | "RESOLVED"
  | "TOOL_FAILURE";

export type EvidenceAgentName = "policy" | "clinical" | "cost_contract";

// ─── Case Record ───
export interface CaseRecord {
  id: string;
  case_id: string;
  case_version: number;
  patient_consent_status: boolean;
  patient_consent_timestamp: string | null;
  hospital_clinical_confirmation_status: boolean;
  hospital_confirmation_timestamp: string | null;
  member_id: string;
  policy_id: string;
  hospital_id: string;
  diagnosis: string;
  planned_procedure: string;
  planned_date: string;
  evidence_references: string[];
  document_provenance: string;
  current_case_status: CaseStatus;
  source_system: string;
  created_at: string;
  updated_at: string;
}

// ─── Audit Event ───
export interface AuditEvent {
  id: string;
  audit_event_id: string;
  case_id: string;
  case_version: number;
  event_type: string;
  event_data: Record<string, unknown>;
  agent_run_id: string | null;
  created_at: string;
}

// ─── Validation Result ───
export interface ValidationResult {
  case_id: string;
  stored_status: CaseStatus;
  new_case_version: number;
  audit_event_id: string;
  idempotency_result: "CREATED" | "ALREADY_EXISTS";
  stored_at: string;
  verified_fields?: string[];
  missing_fields?: string[];
  conflicts?: string[];
}

// ─── Policy Findings ───
export interface PolicyFindings {
  policy_active: boolean;
  member_eligible: boolean;
  procedure_covered: boolean;
  original_policy_inception: string;
  planned_admission_date: string;
  waiting_period_months: number;
  waiting_period_satisfied: boolean;
  continuous_coverage_confirmed: boolean;
  applicable_exclusion_found: boolean;
  applicable_pre_existing_disease_restriction_found: boolean;
  network_hospital_confirmed: boolean;
  hospital_id: string;
  room_eligibility: string;
  procedure_sub_limit: number;
  co_payment_rate: number;
  deductible_amount: number;
}

// ─── Clinical Findings ───
export interface ClinicalFindings {
  diagnosis: string;
  planned_procedure: string;
  clinical_record_version: string;
  doctor_recommendation_confirmed: boolean;
  diagnostic_support_confirmed: boolean;
  medical_necessity_supported: boolean;
  planned_pre_authorisation_ready: boolean;
  post_authorisation_conditions: string[];
}

// ─── Cost & Contract Findings ───
export interface CostContractFindings {
  hospital_id: string;
  network_status: string;
  contract_reference: string;
  contract_version: string;
  estimate_reference: string;
  estimate_version: string;
  calculation_version: string;
  eligible_estimate_total: number;
  contracted_package_rate: number;
  non_payable_total: number;
  expected_insurer_contribution: number;
  expected_patient_contribution: number;
  currency: string;
}

// ─── Evidence Report ───
export interface EvidenceReport {
  id: string;
  case_id: string;
  case_version: number;
  agent_name: EvidenceAgentName;
  report_status: string;
  findings: PolicyFindings | ClinicalFindings | CostContractFindings;
  citations: string[];
  unresolved_dependencies: string[];
  tool_status: string;
  completed_at: string;
}

// ─── Consolidated Evidence ───
export interface ConsolidatedEvidence {
  case_id: string;
  case_version: number;
  handoff_status: "COMPLETE" | "INCOMPLETE" | "MISSING";
  policy_evidence_result: EvidenceReport | null;
  clinical_evidence_result: EvidenceReport | null;
  cost_contract_result: EvidenceReport | null;
  version_consistency: {
    all_case_ids_match: boolean;
    all_case_versions_match: boolean;
    validated_case_version: number;
  };
}

// ─── Dependency Node ───
export interface DependencyNode {
  dependency_id: string;
  description: string;
  status: "RESOLVED" | "UNRESOLVED" | "POST_AUTHORISATION_CONDITION";
  sources: string[];
  owner: string;
  downstream_impact: string;
  next_safe_action: string;
}

// ─── Resolution Graph ───
export interface ResolutionGraph {
  id: string;
  graph_id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  graph_state: GraphState;
  dependency_nodes: DependencyNode[];
  unresolved_dependencies: string[];
  post_authorisation_conditions: string[];
  state_reason_codes: string[];
  next_safe_action: string;
  source_report_versions: Record<string, string>;
  created_at: string;
}

// ─── Contribution Calculation ───
export interface ContributionCalculation {
  case_id: string;
  case_version: number;
  currency: string;
  eligible_estimate_total: number;
  non_payable_total: number;
  contracted_package_rate: number;
  applicable_sub_limit: number | null;
  contract_eligible_amount: number;
  capped_amount: number;
  co_payment_rate: number;
  co_payment_amount: number;
  deductible_amount: number;
  amount_above_contract_ceiling: number;
  expected_insurer_contribution: number;
  expected_patient_contribution: number;
  calculation_version: string;
  calculated_at: string;
  status: string;
  assumptions: string[];
}

// ─── Decision Packet ───
export interface DecisionPacket {
  id: string;
  packet_id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  generated_at: string;
  pdf_url: string | null;
}

// ─── Human Decision ───
export interface HumanDecision {
  id: string;
  human_decision_id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  packet_id: string;
  reviewer_identity: string;
  reviewer_role: string;
  outcome: HumanOutcome;
  written_reason: string;
  conditions: string[];
  authorised_amount: number | null;
  currency: string | null;
  validity_conditions: string[];
  clarification_fields: string[];
  decision_timestamp: string;
  created_at: string;
}

// ─── Blocker Action ───
export interface BlockerAction {
  id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  dependency_ids: string[];
  blocker_status: BlockerStatus;
  owner: string;
  reason_codes: string[];
  next_safe_action: string;
  created_at: string;
}

// ─── Notification ───
export interface Notification {
  id: string;
  case_id: string;
  notification_type: string;
  recipient_type: "PATIENT" | "HOSPITAL";
  recipient_id: string;
  subject: string;
  body: string;
  status: "SENT" | "FAILED" | "PENDING";
  created_at: string;
}

// ─── API Response wrappers ───
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  error_code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Workflow Step ───
export type WorkflowStep =
  | "VALIDATE_ACTIVATION"
  | "RESOLVE_EVIDENCE"
  | "BUILD_RESOLUTION_GRAPH"
  | "RESOLVE_BLOCKERS"
  | "GENERATE_PACKET_AND_REVIEW"
  | "STORE_OUTCOME";

export interface WorkflowStepResult {
  step: WorkflowStep;
  success: boolean;
  case_id: string;
  case_version: number;
  new_status: CaseStatus;
  details: Record<string, unknown>;
  timestamp: string;
}
