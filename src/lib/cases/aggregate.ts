import type { DependencyNode } from "@/types/workflow";
import type {
  ApiEnvelope,
  BuildCaseAggregateInput,
  CaseAggregate,
  DependencyNodeDto,
} from "./contracts";
import { buildExecutionProof } from "@/lib/yoxa/execution-proof";

const REQUIRED_READ_SOURCES = [
  "workflowRuns",
  "evidenceReports",
  "humanDecisions",
  "decisionPackets",
  "auditEvents",
] as const;

type RequiredReadSource = (typeof REQUIRED_READ_SOURCES)[number];
type DegradableReadSource = "resolutionGraphs";

export class AggregateReadError extends Error {
  readonly code = "AGGREGATE_READ_FAILED";

  constructor(
    readonly sources: RequiredReadSource[],
    message = `AGGREGATE_READ_FAILED: ${sources.join(", ")}`
  ) {
    super(message);
    this.name = "AggregateReadError";
  }
}

function mapDependencyNode(node: DependencyNode): DependencyNodeDto {
  return {
    dependencyId: node.dependency_id,
    description: node.description,
    status: node.status,
    sources: node.sources,
    owner: node.owner,
    downstreamImpact: node.downstream_impact,
    nextSafeAction: node.next_safe_action,
  };
}

function getReadFailures(input: BuildCaseAggregateInput): RequiredReadSource[] {
  return REQUIRED_READ_SOURCES.filter((source) => input[source].error);
}

function getReadWarnings(input: BuildCaseAggregateInput): Array<{
  source: DegradableReadSource;
  code: "READ_FAILED";
}> {
  return input.resolutionGraphs.error
    ? [
        {
          source: "resolutionGraphs",
          code: "READ_FAILED",
        },
      ]
    : [];
}

export function buildCaseAggregate(input: BuildCaseAggregateInput): ApiEnvelope<CaseAggregate> {
  const readFailures = getReadFailures(input);

  if (readFailures.length > 0) {
    throw new AggregateReadError(readFailures);
  }

  const readWarnings = getReadWarnings(input);

  const workflowRuns = (input.workflowRuns.data ?? []).map((workflowRun) => ({
    id: workflowRun.id,
    caseId: workflowRun.case_id,
    workflowKey: workflowRun.workflow_key,
    workflowName: workflowRun.workflow_name ?? workflowRun.workflow_key,
    yoxaExecutionId: workflowRun.yoxa_execution_id,
    idempotencyKey: workflowRun.idempotency_key,
    status: workflowRun.status,
    attempt: workflowRun.attempt,
    inputPayload: workflowRun.input_payload,
    rawResponse: workflowRun.raw_response,
    normalizedOutput: workflowRun.normalized_output,
    errorCode: workflowRun.error_code,
    errorMessage: workflowRun.error_message,
    queuedAt: workflowRun.queued_at,
    startedAt: workflowRun.started_at,
    completedAt: workflowRun.completed_at,
    failedAt: workflowRun.failed_at,
    createdAt: workflowRun.created_at,
    updatedAt: workflowRun.updated_at,
    executionProof: buildExecutionProof(workflowRun),
  }));

  const evidenceReports = (input.evidenceReports.data ?? []).map((evidenceReport) => ({
    id: evidenceReport.id,
    caseId: evidenceReport.case_id,
    caseVersion: evidenceReport.case_version,
    agentName: evidenceReport.agent_name,
    reportStatus: evidenceReport.report_status,
    findings: evidenceReport.findings,
    citations: evidenceReport.citations,
    unresolvedDependencies: evidenceReport.unresolved_dependencies,
    toolStatus: evidenceReport.tool_status,
    completedAt: evidenceReport.completed_at,
  }));

  const latestResolutionGraph = input.resolutionGraphs.data?.[0] ?? null;
  const resolutionGraph = latestResolutionGraph
    ? {
        id: latestResolutionGraph.id,
        graphId: latestResolutionGraph.graph_id,
        caseId: latestResolutionGraph.case_id,
        caseVersion: latestResolutionGraph.case_version,
        graphVersion: latestResolutionGraph.graph_version,
        graphState: latestResolutionGraph.graph_state,
        dependencyNodes: latestResolutionGraph.dependency_nodes.map(mapDependencyNode),
        unresolvedDependencies: latestResolutionGraph.unresolved_dependencies,
        postAuthorisationConditions: latestResolutionGraph.post_authorisation_conditions,
        stateReasonCodes: latestResolutionGraph.state_reason_codes,
        nextSafeAction: latestResolutionGraph.next_safe_action,
        sourceReportVersions: latestResolutionGraph.source_report_versions,
        createdAt: latestResolutionGraph.created_at,
      }
    : null;

  const latestDecisionRow = input.humanDecisions.data?.[0] ?? null;
  const latestDecision = latestDecisionRow
    ? {
        id: latestDecisionRow.id,
        humanDecisionId: latestDecisionRow.human_decision_id,
        caseId: latestDecisionRow.case_id,
        caseVersion: latestDecisionRow.case_version,
        graphVersion: latestDecisionRow.graph_version,
        packetId: latestDecisionRow.packet_id,
        reviewerIdentity: latestDecisionRow.reviewer_identity,
        reviewerRole: latestDecisionRow.reviewer_role,
        outcome: latestDecisionRow.outcome,
        writtenReason: latestDecisionRow.written_reason,
        conditions: latestDecisionRow.conditions,
        authorisedAmount: latestDecisionRow.authorised_amount,
        currency: latestDecisionRow.currency,
        validityConditions: latestDecisionRow.validity_conditions,
        clarificationFields: latestDecisionRow.clarification_fields,
        decisionTimestamp: latestDecisionRow.decision_timestamp,
        createdAt: latestDecisionRow.created_at,
      }
    : null;

  const latestPacketRow = input.decisionPackets.data?.[0] ?? null;
  const latestPacket = latestPacketRow
    ? {
        id: latestPacketRow.id,
        packetId: latestPacketRow.packet_id,
        caseId: latestPacketRow.case_id,
        caseVersion: latestPacketRow.case_version,
        graphVersion: latestPacketRow.graph_version,
        generatedAt: latestPacketRow.generated_at,
        pdfUrl: latestPacketRow.pdf_url ?? null,
      }
    : null;

  const pendingApproval = workflowRuns.find((workflowRun) => workflowRun.status === "WAITING_FOR_HUMAN");

  const auditEvents = (input.auditEvents.data ?? []).map((auditEvent) => ({
    id: auditEvent.id,
    auditEventId: auditEvent.audit_event_id,
    caseId: auditEvent.case_id,
    caseVersion: auditEvent.case_version,
    eventType: auditEvent.event_type,
    eventData: auditEvent.event_data,
    agentRunId: auditEvent.agent_run_id,
    createdAt: auditEvent.created_at,
  }));

  return {
    success: true,
    data: {
      case: {
        id: input.caseRecord.id,
        caseId: input.caseRecord.case_id,
        caseVersion: input.caseRecord.case_version,
        patientConsentStatus: input.caseRecord.patient_consent_status,
        patientConsentTimestamp: input.caseRecord.patient_consent_timestamp,
        hospitalClinicalConfirmationStatus: input.caseRecord.hospital_clinical_confirmation_status,
        hospitalConfirmationTimestamp: input.caseRecord.hospital_confirmation_timestamp,
        memberId: input.caseRecord.member_id,
        policyId: input.caseRecord.policy_id,
        hospitalId: input.caseRecord.hospital_id,
        diagnosis: input.caseRecord.diagnosis,
        plannedProcedure: input.caseRecord.planned_procedure,
        plannedDate: input.caseRecord.planned_date,
        evidenceReferences: input.caseRecord.evidence_references,
        documentProvenance: input.caseRecord.document_provenance,
        currentCaseStatus: input.caseRecord.current_case_status,
        sourceSystem: input.caseRecord.source_system,
        createdAt: input.caseRecord.created_at,
        updatedAt: input.caseRecord.updated_at,
      },
      status: input.caseRecord.current_case_status,
      readWarnings,
      workflowRuns,
      evidenceReports,
      resolutionGraph,
      latestDecision,
      latestPacket,
      pendingApproval: pendingApproval
        ? {
            workflowKey: pendingApproval.workflowKey,
            status: pendingApproval.status,
          }
        : null,
      auditEvents,
    },
  };
}
