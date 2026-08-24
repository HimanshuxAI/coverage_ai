import type {
  AuditEvent,
  CaseRecord,
  DependencyNode,
  EvidenceReport,
  ResolutionGraph,
} from "@/types/workflow";
import type { ExecutionProof } from "@/lib/yoxa/execution-proof";
import type { WorkflowRunStatus } from "@/lib/yoxa/types";

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface AggregateReadResult<T> {
  data: T[] | null;
  error: unknown | null;
}

export interface WorkflowRunRow {
  id: string;
  case_id: string;
  workflow_key: string;
  workflow_name: string | null;
  yoxa_execution_id: string | null;
  idempotency_key: string;
  status: WorkflowRunStatus;
  attempt: number;
  input_payload: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  normalized_output: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HumanDecisionRow {
  id: string;
  human_decision_id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  packet_id: string;
  reviewer_identity: string;
  reviewer_role: string;
  outcome: string;
  written_reason: string;
  conditions: string[];
  authorised_amount: number | null;
  currency: string | null;
  validity_conditions: string[];
  clarification_fields: string[];
  decision_timestamp: string;
  created_at: string;
}

export interface DecisionPacketRow {
  id: string;
  packet_id: string;
  case_id: string;
  case_version: number;
  graph_version: number;
  generated_at: string;
  pdf_url?: string | null;
}

export interface CaseDto {
  id: string;
  caseId: string;
  caseVersion: number;
  patientConsentStatus: boolean;
  patientConsentTimestamp: string | null;
  hospitalClinicalConfirmationStatus: boolean;
  hospitalConfirmationTimestamp: string | null;
  memberId: string;
  policyId: string;
  hospitalId: string;
  diagnosis: string;
  plannedProcedure: string;
  plannedDate: string;
  evidenceReferences: string[];
  documentProvenance: string;
  currentCaseStatus: string;
  sourceSystem: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunDto {
  id: string;
  caseId: string;
  workflowKey: string;
  workflowName: string;
  yoxaExecutionId: string | null;
  idempotencyKey: string;
  status: WorkflowRunStatus;
  attempt: number;
  inputPayload: Record<string, unknown> | null;
  rawResponse: Record<string, unknown> | null;
  normalizedOutput: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  executionProof: ExecutionProof;
}

export interface EvidenceReportDto {
  id: string;
  caseId: string;
  caseVersion: number;
  agentName: string;
  reportStatus: string;
  findings: EvidenceReport["findings"];
  citations: string[];
  unresolvedDependencies: string[];
  toolStatus: string;
  completedAt: string;
}

export interface DependencyNodeDto {
  dependencyId: string;
  description: string;
  status: DependencyNode["status"];
  sources: string[];
  owner: string;
  downstreamImpact: string;
  nextSafeAction: string;
}

export interface ResolutionGraphDto {
  id: string;
  graphId: string;
  caseId: string;
  caseVersion: number;
  graphVersion: number;
  graphState: ResolutionGraph["graph_state"];
  dependencyNodes: DependencyNodeDto[];
  unresolvedDependencies: string[];
  postAuthorisationConditions: string[];
  stateReasonCodes: string[];
  nextSafeAction: string;
  sourceReportVersions: Record<string, string>;
  createdAt: string;
}

export interface HumanDecisionDto {
  id: string;
  humanDecisionId: string;
  caseId: string;
  caseVersion: number;
  graphVersion: number;
  packetId: string;
  reviewerIdentity: string;
  reviewerRole: string;
  outcome: string;
  writtenReason: string;
  conditions: string[];
  authorisedAmount: number | null;
  currency: string | null;
  validityConditions: string[];
  clarificationFields: string[];
  decisionTimestamp: string;
  createdAt: string;
}

export interface DecisionPacketDto {
  id: string;
  packetId: string;
  caseId: string;
  caseVersion: number;
  graphVersion: number;
  generatedAt: string;
  pdfUrl: string | null;
}

export interface AuditEventDto {
  id: string;
  auditEventId: string;
  caseId: string;
  caseVersion: number;
  eventType: string;
  eventData: AuditEvent["event_data"];
  agentRunId: string | null;
  createdAt: string;
}

export interface PendingApprovalDto {
  workflowKey: string;
  status: string;
}

export type CaseAggregateReadWarningSource = "resolutionGraphs";
export type CaseAggregateReadWarningCode = "READ_FAILED";

export interface CaseAggregateReadWarning {
  source: CaseAggregateReadWarningSource;
  code: CaseAggregateReadWarningCode;
}

export interface CaseAggregate {
  case: CaseDto;
  status: string;
  readWarnings: CaseAggregateReadWarning[];
  workflowRuns: WorkflowRunDto[];
  evidenceReports: EvidenceReportDto[];
  resolutionGraph: ResolutionGraphDto | null;
  latestDecision: HumanDecisionDto | null;
  latestPacket: DecisionPacketDto | null;
  pendingApproval: PendingApprovalDto | null;
  auditEvents: AuditEventDto[];
}

export interface BuildCaseAggregateInput {
  caseRecord: CaseRecord;
  workflowRuns: AggregateReadResult<WorkflowRunRow>;
  evidenceReports: AggregateReadResult<EvidenceReport>;
  resolutionGraphs: AggregateReadResult<ResolutionGraph>;
  humanDecisions: AggregateReadResult<HumanDecisionRow>;
  decisionPackets: AggregateReadResult<DecisionPacketRow>;
  auditEvents: AggregateReadResult<AuditEvent>;
}
