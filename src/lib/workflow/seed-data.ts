/* ======================================================
   YOXA — Demo Seed Data
   Seeds the happy-path case CASE-CT-0001
   ====================================================== */

import type { AuditEvent, CaseRecord, HumanDecision, ResolutionGraph } from "@/types/workflow";
import type { WorkflowRunRecord } from "@/lib/yoxa/types";

export const DEMO_CASE: Omit<CaseRecord, "id" | "created_at" | "updated_at"> = {
  case_id: "CASE-CT-0001",
  case_version: 2,
  patient_consent_status: true,
  patient_consent_timestamp: "2026-08-16T18:05:00+05:30",
  hospital_clinical_confirmation_status: true,
  hospital_confirmation_timestamp: "2026-08-16T18:10:00+05:30",
  member_id: "MBR-ASHA-1042",
  policy_id: "CT-HEALTH-2026-001",
  hospital_id: "HSP-NIR-021",
  diagnosis: "Symptomatic cholelithiasis",
  planned_procedure: "Laparoscopic cholecystectomy",
  planned_date: "2026-08-24",
  evidence_references: [
    "CoverageTwin_Demo_Policy.pdf",
    "CoverageTwin_Demo_Clinical_Record.pdf",
    "CoverageTwin_Demo_Estimate_Contract.pdf",
  ],
  document_provenance: "VERIFIED",
  current_case_status: "AUTHORISED_BY_HUMAN",
  source_system: "coverage_twin_case_registry",
};

// Simulated policy evidence for the demo case
export const DEMO_POLICY_EVIDENCE = {
  case_id: "CASE-CT-0001",
  case_version: 2,
  agent_name: "policy" as const,
  report_status: "SUPPORTED",
  findings: {
    policy_active: true,
    member_eligible: true,
    procedure_covered: true,
    original_policy_inception: "2023-04-01",
    planned_admission_date: "2026-08-24",
    waiting_period_months: 24,
    waiting_period_satisfied: true,
    continuous_coverage_confirmed: true,
    applicable_exclusion_found: false,
    applicable_pre_existing_disease_restriction_found: false,
    network_hospital_confirmed: true,
    hospital_id: "HSP-NIR-021",
    room_eligibility: "Single private room up to INR 5,000 per day",
    procedure_sub_limit: 120000,
    co_payment_rate: 0.1,
    deductible_amount: 5000,
  },
  citations: [
    "ASP-2026.1 Policy Schedule, page 1",
    "ASP-2026.1 Clause 2.1, page 1",
    "ASP-2026.1 Clause 2.4, page 1",
    "ASP-2026.1 Clause 3.2, page 1",
    "ASP-2026.1 Clause 4.1, page 1",
    "ASP-2026.1 Clause 5.3, page 1",
    "ASP-2026.1 Clause 6.1",
    "ASP-2026.1 Clause 8.4, page 2",
  ],
  unresolved_dependencies: [],
  tool_status: "SUCCESS",
};

// Simulated clinical evidence for the demo case
export const DEMO_CLINICAL_EVIDENCE = {
  case_id: "CASE-CT-0001",
  case_version: 2,
  agent_name: "clinical" as const,
  report_status: "SUPPORTED",
  findings: {
    diagnosis: "Symptomatic cholelithiasis",
    planned_procedure: "Laparoscopic cholecystectomy",
    clinical_record_version: "CLIN-3",
    doctor_recommendation_confirmed: true,
    diagnostic_support_confirmed: true,
    medical_necessity_supported: true,
    planned_pre_authorisation_ready: true,
    post_authorisation_conditions: ["CLINICAL-FITNESS-001"],
  },
  citations: [
    "Clinical Record CLIN-3",
  ],
  unresolved_dependencies: [],
  tool_status: "SUCCESS",
};

// Simulated cost & contract evidence for the demo case
export const DEMO_COST_EVIDENCE = {
  case_id: "CASE-CT-0001",
  case_version: 2,
  agent_name: "cost_contract" as const,
  report_status: "SUPPORTED_PROVISIONALLY",
  findings: {
    hospital_id: "HSP-NIR-021",
    network_status: "CONFIRMED",
    contract_reference: "NIR-ASP-2026",
    contract_version: "CONTRACT-2026.2",
    estimate_reference: "EST-2026-8841",
    estimate_version: "EST-2",
    calculation_version: "CALC-1.0",
    eligible_estimate_total: 105000,
    contracted_package_rate: 100000,
    non_payable_total: 7000,
    expected_insurer_contribution: 85000,
    expected_patient_contribution: 27000,
    currency: "INR",
  },
  citations: [
    "Contract NIR-ASP-2026 v CONTRACT-2026.2",
    "Estimate EST-2026-8841 v EST-2",
  ],
  unresolved_dependencies: [],
  tool_status: "SUCCESS",
};

// Policy citations used in decision packet
export const POLICY_CITATIONS = [
  "ASP-2026.1 Policy Schedule, page 1",
  "Clause 2.1 — In-patient hospitalisation, page 1",
  "Clause 2.4 — Planned cashless pre-authorisation, page 1",
  "Clause 3.2 — Laparoscopic cholecystectomy, page 1",
  "Clause 4.1 — Waiting period, page 1",
  "Clause 5.3 — Room eligibility, page 1",
  "Clause 6.1 — Co-payment and deductible",
  "Clause 8.4 — Human authority, page 2",
];

export const DEMO_EVIDENCE_REPORTS = [
  DEMO_POLICY_EVIDENCE,
  DEMO_CLINICAL_EVIDENCE,
  DEMO_COST_EVIDENCE,
] as const;

export const DEMO_RESOLUTION_GRAPH = {
  graph_id: "graph-demo-case-ct-0001-v2",
  case_id: "CASE-CT-0001",
  case_version: 2,
  graph_version: 1,
  graph_state: "DECISION_READY",
  dependency_nodes: [
    {
      dependency_id: "POLICY-COVERAGE-001",
      description: "Policy is active, member is eligible, and laparoscopic cholecystectomy is covered.",
      status: "RESOLVED",
      sources: ["policy", "clinical"],
      owner: "coverage-policy-agent",
      downstream_impact: "Supports planned cashless pre-authorisation.",
      next_safe_action: "Proceed to contribution calculation.",
    },
    {
      dependency_id: "CLINICAL-NECESSITY-001",
      description: "Clinical evidence supports symptomatic cholelithiasis and planned laparoscopic treatment.",
      status: "RESOLVED",
      sources: ["clinical"],
      owner: "clinical-evidence-agent",
      downstream_impact: "Confirms medical necessity for the requested procedure.",
      next_safe_action: "Retain clinical fitness condition for discharge.",
    },
    {
      dependency_id: "FINANCIAL-CONTRACT-001",
      description: "Network hospital contract, estimate, deductible, and co-payment rules were reconciled.",
      status: "RESOLVED",
      sources: ["cost_contract", "policy"],
      owner: "cost-contract-agent",
      downstream_impact: "Produces expected insurer contribution of INR 85,000.",
      next_safe_action: "Present benefit recommendation for human authorization.",
    },
    {
      dependency_id: "CLINICAL-FITNESS-001",
      description: "Final clinical fitness and discharge summary remain post-authorisation conditions.",
      status: "POST_AUTHORISATION_CONDITION",
      sources: ["clinical"],
      owner: "hospital-desk",
      downstream_impact: "Must be checked before final settlement.",
      next_safe_action: "Collect discharge evidence before settlement.",
    },
  ],
  unresolved_dependencies: [],
  post_authorisation_conditions: ["CLINICAL-FITNESS-001", "FINAL-BILL-RECONCILIATION"],
  state_reason_codes: [
    "POLICY_ACTIVE",
    "PROCEDURE_COVERED",
    "MEDICAL_NECESSITY_SUPPORTED",
    "NETWORK_CONTRACT_RECONCILED",
    "HUMAN_AUTHORISATION_REQUIRED",
  ],
  next_safe_action: "Human reviewer may authorise INR 85,000 with discharge and final-bill conditions.",
  source_report_versions: {
    policy: "policy:v2",
    clinical: "clinical:v2",
    cost_contract: "cost_contract:v2",
  },
} as const satisfies Omit<ResolutionGraph, "id" | "created_at">;

export const DEMO_DECISION_PACKET = {
  packet_id: "packet-demo-case-ct-0001-v2",
  case_id: "CASE-CT-0001",
  case_version: 2,
  graph_version: 1,
  packet_data: {
    recommendation: "AUTHORISE",
    recommended_benefit: 85000,
    currency: "INR",
    patient_contribution: 27000,
    summary:
      "Coverage Twin reconciled policy, clinical necessity, hospital contract, deductible, and co-payment evidence for a planned cashless laparoscopic cholecystectomy.",
    evidence: {
      policy: "Procedure covered under active health policy after waiting period satisfaction.",
      clinical: "Medical necessity supported by clinical record CLIN-3.",
      financial: "Contracted package and non-payable items reconciled against NIR-ASP-2026.",
    },
    conditions: ["Final clinical fitness at admission", "Discharge summary and final bill before settlement"],
    citations: POLICY_CITATIONS,
  },
};

export const DEMO_HUMAN_DECISION = {
  human_decision_id: "human-decision-demo-case-ct-0001-v2",
  case_id: "CASE-CT-0001",
  case_version: 2,
  graph_version: 1,
  packet_id: DEMO_DECISION_PACKET.packet_id,
  reviewer_identity: "Dr. Kavya Rao",
  reviewer_role: "Senior Medical Adjudicator",
  outcome: "AUTHORISE",
  written_reason:
    "Authorised after policy eligibility, medical necessity, network contract, deductible, and co-payment checks aligned across the resolution graph.",
  conditions: ["Clinical fitness confirmation at admission", "Final bill and discharge summary before settlement"],
  authorised_amount: 85000,
  currency: "INR",
  validity_conditions: ["Admission on or before 24 Aug 2026", "Network package NIR-ASP-2026 applies"],
  clarification_fields: [],
  decision_timestamp: "2026-08-24T11:15:00+05:30",
} as const satisfies Omit<HumanDecision, "id" | "created_at">;

export const DEMO_WORKFLOW_RUNS = [
  {
    case_id: "CASE-CT-0001",
    workflow_key: "intake",
    workflow_name: "coverage-twin-intake-context",
    yoxa_execution_id: "demo-yoxa-intake-0001",
    idempotency_key: "demo-case-ct-0001-intake",
    status: "COMPLETED",
    attempt: 1,
    input_payload: { demo: true, trigger_text: "Seeded video demo intake normalisation" },
    raw_response: { status: 202, accepted: true },
    normalized_output: { case_context_normalized: true, consent_verified: true },
    error_code: null,
    error_message: null,
    queued_at: "2026-08-24T05:15:00.000Z",
    started_at: "2026-08-24T05:15:12.000Z",
    completed_at: "2026-08-24T05:16:30.000Z",
    failed_at: null,
  },
  {
    case_id: "CASE-CT-0001",
    workflow_key: "preauth",
    workflow_name: "workflow_planned_cashless_preauthorisation",
    yoxa_execution_id: "demo-yoxa-preauth-0001",
    idempotency_key: "demo-case-ct-0001-preauth",
    status: "COMPLETED",
    attempt: 1,
    input_payload: { demo: true, trigger_text: "Seeded video demo pre-authorisation" },
    raw_response: { status: 202, accepted: true },
    normalized_output: {
      evidence_reports: 3,
      resolution_graph: DEMO_RESOLUTION_GRAPH.graph_id,
      packet_id: DEMO_DECISION_PACKET.packet_id,
      recommended_benefit: 85000,
    },
    error_code: null,
    error_message: null,
    queued_at: "2026-08-24T05:17:00.000Z",
    started_at: "2026-08-24T05:17:15.000Z",
    completed_at: "2026-08-24T05:19:30.000Z",
    failed_at: null,
  },
  {
    case_id: "CASE-CT-0001",
    workflow_key: "discharge",
    workflow_name: "coverage-twin-discharge-evidence-collection",
    yoxa_execution_id: "demo-yoxa-discharge-0001",
    idempotency_key: "demo-case-ct-0001-discharge",
    status: "RUNNING",
    attempt: 1,
    input_payload: { demo: true, trigger_text: "Seeded video demo discharge evidence collection" },
    raw_response: { status: 202, accepted: true },
    normalized_output: { awaiting_discharge_summary: true, safe_to_poll: true },
    error_code: null,
    error_message: null,
    queued_at: "2026-08-24T05:25:00.000Z",
    started_at: "2026-08-24T05:25:14.000Z",
    completed_at: null,
    failed_at: null,
  },
] as const satisfies readonly Omit<WorkflowRunRecord, "id" | "created_at" | "updated_at">[];

export const DEMO_AUDIT_EVENTS = [
  {
    audit_event_id: "audit-demo-intake-normalised",
    case_id: "CASE-CT-0001",
    case_version: 2,
    event_type: "DEMO_INTAKE_NORMALISED",
    event_data: {
      summary: "Member, policy, provider, procedure, and consent context normalised for the demo journey.",
    },
    agent_run_id: "demo-yoxa-intake-0001",
    created_at: "2026-08-24T05:16:30.000Z",
  },
  {
    audit_event_id: "audit-demo-evidence-resolved",
    case_id: "CASE-CT-0001",
    case_version: 2,
    event_type: "DEMO_EVIDENCE_RESOLVED",
    event_data: {
      reports: ["policy", "clinical", "cost_contract"],
      unresolved_dependencies: 0,
    },
    agent_run_id: "demo-yoxa-preauth-0001",
    created_at: "2026-08-24T05:18:45.000Z",
  },
  {
    audit_event_id: "audit-demo-resolution-graph-built",
    case_id: "CASE-CT-0001",
    case_version: 2,
    event_type: "DEMO_RESOLUTION_GRAPH_BUILT",
    event_data: {
      graph_id: DEMO_RESOLUTION_GRAPH.graph_id,
      graph_state: DEMO_RESOLUTION_GRAPH.graph_state,
      dependency_count: DEMO_RESOLUTION_GRAPH.dependency_nodes.length,
    },
    agent_run_id: "demo-yoxa-preauth-0001",
    created_at: "2026-08-24T05:19:00.000Z",
  },
  {
    audit_event_id: "audit-demo-human-authorised",
    case_id: "CASE-CT-0001",
    case_version: 2,
    event_type: "DEMO_HUMAN_AUTHORISED",
    event_data: {
      outcome: "AUTHORISE",
      authorised_amount: 85000,
      currency: "INR",
    },
    agent_run_id: "human-decision-demo-case-ct-0001-v2",
    created_at: "2026-08-24T05:45:00.000Z",
  },
  {
    audit_event_id: "audit-demo-discharge-running",
    case_id: "CASE-CT-0001",
    case_version: 2,
    event_type: "DEMO_DISCHARGE_COLLECTION_RUNNING",
    event_data: {
      workflow_key: "discharge",
      duplicate_trigger_guard: "process action hidden while seeded discharge run is RUNNING",
    },
    agent_run_id: "demo-yoxa-discharge-0001",
    created_at: "2026-08-24T05:55:14.000Z",
  },
] as const satisfies readonly Omit<AuditEvent, "id">[];
