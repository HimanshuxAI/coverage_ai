import { describe, expect, it } from "vitest";

import { buildCaseAggregate } from "./aggregate";

const caseRow = {
  id: "case-row-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  patient_consent_status: true,
  patient_consent_timestamp: "2026-08-24T10:00:00.000Z",
  hospital_clinical_confirmation_status: true,
  hospital_confirmation_timestamp: "2026-08-24T11:00:00.000Z",
  member_id: "MEM-001",
  policy_id: "POL-001",
  hospital_id: "HOSP-001",
  diagnosis: "Gallstones",
  planned_procedure: "Laparoscopic cholecystectomy",
  planned_date: "2026-08-28",
  evidence_references: ["evidence://scan-1"],
  document_provenance: "member-upload",
  current_case_status: "DECISION_READY",
  source_system: "manual-seed",
  created_at: "2026-08-24T09:00:00.000Z",
  updated_at: "2026-08-24T12:00:00.000Z",
};

const waitingApprovalRunRow = {
  id: "run-2",
  case_id: "CASE-CT-REAL-001",
  workflow_key: "appeal",
  workflow_name: "Appeal",
  yoxa_execution_id: "yoxa-run-2",
  idempotency_key: "idem-2",
  status: "WAITING_FOR_HUMAN",
  attempt: 1,
  input_payload: { workflowKey: "appeal" },
  raw_response: { workflow_run_id: "yoxa-run-2" },
  normalized_output: { triggered: true },
  error_code: null,
  error_message: null,
  queued_at: "2026-08-24T11:00:00.000Z",
  started_at: "2026-08-24T11:01:00.000Z",
  completed_at: null,
  failed_at: null,
  created_at: "2026-08-24T11:00:00.000Z",
  updated_at: "2026-08-24T11:02:00.000Z",
};

const runningWorkflowRunRow = {
  id: "run-1",
  case_id: "CASE-CT-REAL-001",
  workflow_key: "preauth",
  workflow_name: "Pre-auth",
  yoxa_execution_id: "yoxa-run-1",
  idempotency_key: "idem-1",
  status: "RUNNING",
  attempt: 1,
  input_payload: { workflowKey: "preauth" },
  raw_response: { workflow_run_id: "yoxa-run-1" },
  normalized_output: { triggered: true },
  error_code: null,
  error_message: null,
  queued_at: "2026-08-24T10:30:00.000Z",
  started_at: "2026-08-24T10:31:00.000Z",
  completed_at: null,
  failed_at: null,
  created_at: "2026-08-24T10:30:00.000Z",
  updated_at: "2026-08-24T10:32:00.000Z",
};

const evidenceReportRow = {
  id: "evidence-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  agent_name: "policy",
  report_status: "COMPLETE",
  findings: {
    policy_active: true,
    member_eligible: true,
  },
  citations: ["policy.pdf#page=3"],
  unresolved_dependencies: [],
  tool_status: "SUCCESS",
  completed_at: "2026-08-24T10:45:00.000Z",
};

const resolutionGraphRow = {
  id: "graph-row-1",
  graph_id: "graph-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  graph_version: 3,
  graph_state: "DECISION_READY",
  dependency_nodes: [
    {
      dependency_id: "dep-1",
      description: "Policy evidence collected",
      status: "RESOLVED",
      sources: ["policy"],
      owner: "policy",
      downstream_impact: "ready-for-review",
      next_safe_action: "Proceed to human review",
    },
  ],
  unresolved_dependencies: [],
  post_authorisation_conditions: ["Post-op follow-up within 30 days"],
  state_reason_codes: ["POLICY_CLEAR", "CLINICAL_CLEAR"],
  next_safe_action: "Prepare decision packet",
  source_report_versions: { policy: "policy-v1" },
  created_at: "2026-08-24T10:50:00.000Z",
};

const latestDecisionRow = {
  id: "decision-row-1",
  human_decision_id: "decision-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  graph_version: 3,
  packet_id: "packet-1",
  reviewer_identity: "judge@example.com",
  reviewer_role: "Medical Director",
  outcome: "AUTHORISE",
  written_reason: "All required evidence is complete.",
  conditions: ["Notify hospital desk"],
  authorised_amount: 85000,
  currency: "INR",
  validity_conditions: ["Admit within 7 days"],
  clarification_fields: [],
  decision_timestamp: "2026-08-24T10:55:00.000Z",
  created_at: "2026-08-24T10:55:00.000Z",
};

const latestPacketRow = {
  id: "packet-row-1",
  packet_id: "packet-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  graph_version: 3,
  generated_at: "2026-08-24T10:53:00.000Z",
  pdf_url: "https://example.com/packet.pdf",
};

const auditEventRow = {
  id: "audit-row-1",
  audit_event_id: "audit-1",
  case_id: "CASE-CT-REAL-001",
  case_version: 7,
  event_type: "WORKFLOW_TRIGGERED_PREAUTH",
  event_data: { workflow_key: "preauth" },
  agent_run_id: null,
  created_at: "2026-08-24T10:31:30.000Z",
};

describe("buildCaseAggregate", () => {
  it("wraps normalized camelCase rows in a success envelope", () => {
    const result = buildCaseAggregate({
      caseRecord: caseRow,
      workflowRuns: { data: [waitingApprovalRunRow, runningWorkflowRunRow], error: null },
      evidenceReports: { data: [evidenceReportRow], error: null },
      resolutionGraphs: { data: [resolutionGraphRow], error: null },
      humanDecisions: { data: [latestDecisionRow], error: null },
      decisionPackets: { data: [latestPacketRow], error: null },
      auditEvents: { data: [auditEventRow], error: null },
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        case: {
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          memberId: "MEM-001",
          policyId: "POL-001",
          hospitalId: "HOSP-001",
          plannedProcedure: "Laparoscopic cholecystectomy",
          plannedDate: "2026-08-28",
          evidenceReferences: ["evidence://scan-1"],
          documentProvenance: "member-upload",
          currentCaseStatus: "DECISION_READY",
          sourceSystem: "manual-seed",
        },
        status: "DECISION_READY",
        workflowRuns: [
          {
            workflowKey: "appeal",
            workflowName: "Appeal",
            yoxaExecutionId: "yoxa-run-2",
            idempotencyKey: "idem-2",
            queuedAt: "2026-08-24T11:00:00.000Z",
          },
          {
            workflowKey: "preauth",
            workflowName: "Pre-auth",
            yoxaExecutionId: "yoxa-run-1",
            idempotencyKey: "idem-1",
            queuedAt: "2026-08-24T10:30:00.000Z",
          },
        ],
        evidenceReports: [
          {
            caseId: "CASE-CT-REAL-001",
            caseVersion: 7,
            agentName: "policy",
            reportStatus: "COMPLETE",
            unresolvedDependencies: [],
            toolStatus: "SUCCESS",
          },
        ],
        resolutionGraph: {
          graphId: "graph-1",
          graphVersion: 3,
          graphState: "DECISION_READY",
          dependencyNodes: [
            {
              dependencyId: "dep-1",
              downstreamImpact: "ready-for-review",
              nextSafeAction: "Proceed to human review",
            },
          ],
          stateReasonCodes: ["POLICY_CLEAR", "CLINICAL_CLEAR"],
        },
        latestDecision: {
          humanDecisionId: "decision-1",
          reviewerIdentity: "judge@example.com",
          reviewerRole: "Medical Director",
          writtenReason: "All required evidence is complete.",
          authorisedAmount: 85000,
          decisionTimestamp: "2026-08-24T10:55:00.000Z",
        },
        latestPacket: {
          packetId: "packet-1",
          generatedAt: "2026-08-24T10:53:00.000Z",
          pdfUrl: "https://example.com/packet.pdf",
        },
        pendingApproval: {
          workflowKey: "appeal",
          status: "WAITING_FOR_HUMAN",
        },
        auditEvents: [
          {
            auditEventId: "audit-1",
            eventType: "WORKFLOW_TRIGGERED_PREAUTH",
            eventData: { workflow_key: "preauth" },
          },
        ],
      },
    });
  });

  it("preserves successful empty reads as empty arrays or nulls", () => {
    const result = buildCaseAggregate({
      caseRecord: caseRow,
      workflowRuns: { data: [], error: null },
      evidenceReports: { data: [], error: null },
      resolutionGraphs: { data: [], error: null },
      humanDecisions: { data: [], error: null },
      decisionPackets: { data: [], error: null },
      auditEvents: { data: [], error: null },
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        workflowRuns: [],
        evidenceReports: [],
        resolutionGraph: null,
        latestDecision: null,
        latestPacket: null,
        pendingApproval: null,
        auditEvents: [],
      },
    });
  });

  it("throws a named aggregate read failure when a required related query errors", () => {
    const build = () =>
      buildCaseAggregate({
        caseRecord: caseRow,
        workflowRuns: { data: [runningWorkflowRunRow], error: null },
        evidenceReports: { data: [evidenceReportRow], error: null },
        resolutionGraphs: { data: [resolutionGraphRow], error: null },
        humanDecisions: { data: [latestDecisionRow], error: null },
        decisionPackets: { data: [latestPacketRow], error: null },
        auditEvents: {
          data: null,
          error: { message: "audit read exploded" },
        },
      });

    expect(build).toThrowError(/AGGREGATE_READ_FAILED/);

    try {
      build();
    } catch (error) {
      expect(error).toMatchObject({
        name: "AggregateReadError",
        code: "AGGREGATE_READ_FAILED",
        sources: ["auditEvents"],
      });
      return;
    }

    throw new Error("Expected buildCaseAggregate to throw an AggregateReadError");
  });
});
