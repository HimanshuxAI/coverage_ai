import { getStatusPresentation, type StatusPresentation } from "@/lib/workflow/presentation";
import {
  getWorkflowStatusPresentation,
  isTerminalWorkflowStatus,
  isWorkflowRunStatus,
  shouldPollWorkflowRuns,
  type WorkflowStatusPresentation,
  type WorkflowStatusTone,
} from "@/lib/yoxa/status-presentation";
import type { WorkflowRunStatus } from "@/lib/yoxa/types";

import type { ApiEnvelope, CaseAggregate } from "./contracts";
import type { ExecutionProof } from "@/lib/yoxa/execution-proof";

export type CommandCenterLoadState = "loading" | "ready" | "stale" | "noRecord" | "error";

interface RequestErrorState {
  kind: Extract<CommandCenterLoadState, "noRecord" | "error">;
  message: string;
}

export interface CommandCenterViewModel {
  caseRecord: CaseAggregate["case"];
  status: CaseAggregate["status"];
  evidence: {
    count: number;
    provenance: string;
    reports: CaseAggregate["evidenceReports"];
  };
  decision: {
    record: CaseAggregate["latestDecision"];
    factors: string[];
  };
  workflow: {
    runs: CommandCenterWorkflowRunViewModel[];
    shouldPoll: boolean;
    activity: CommandCenterWorkflowActivityItem[];
  };
  audit: {
    events: CaseAggregate["auditEvents"];
  };
  packet: {
    record: CaseAggregate["latestPacket"];
  };
  approval: {
    pending: CaseAggregate["pendingApproval"];
  };
  resolutionGraph: {
    record: CaseAggregate["resolutionGraph"];
    availability: "available" | "noRecord" | "unavailable";
  };
}

export interface CommandCenterProofStripItem {
  label: string;
  value: string;
  tone: WorkflowStatusTone;
}

export interface CommandCenterCopyField {
  key:
    | "caseId"
    | "memberId"
    | "policyId"
    | "providerId"
    | "localRunId"
    | "yoxaExecutionId"
    | "idempotencyKey";
  label: string;
  value: string;
}

export type CommandCenterPacketAction =
  | {
      kind: "open";
      href: string;
      label: "OPEN PACKET PDF";
    };

export interface CommandCenterManualRefreshAction {
  intent: "aggregate-read";
  label: "REFRESH AGGREGATE" | "RETRY AGGREGATE FETCH" | "REFRESHING AGGREGATE...";
}

export interface CommandCenterWorkflowRunInspector {
  workflowName: string;
  workflowKey: string;
  statusLabel: string;
  proofStateLabel: string;
  localRunId: string;
  yoxaExecutionId: string;
  idempotencyKey: string;
  attempt: string;
  queuedAt: string;
  dispatchedAt: string;
  startedAt: string;
  completedAt: string;
  failedAt: string;
  createdAt: string;
  updatedAt: string;
  upstreamStatusCode: string;
  acceptedResponse: string;
  terminalState: string;
}

export interface CommandCenterWorkflowRunViewModel
  extends Omit<CaseAggregate["workflowRuns"][number], "status"> {
  status: WorkflowRunStatus;
  statusPresentation: WorkflowStatusPresentation;
  proofStrip: CommandCenterProofStripItem[];
  inspector: CommandCenterWorkflowRunInspector;
}

export interface CommandCenterWorkflowActivityItem {
  id: string;
  eventType: string;
  recordedAt: string;
  actor: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

function isCaseDto(value: unknown): value is CaseAggregate["case"] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.caseId) &&
    typeof value.caseVersion === "number" &&
    isBoolean(value.patientConsentStatus) &&
    isNullableString(value.patientConsentTimestamp) &&
    isBoolean(value.hospitalClinicalConfirmationStatus) &&
    isNullableString(value.hospitalConfirmationTimestamp) &&
    isString(value.memberId) &&
    isString(value.policyId) &&
    isString(value.hospitalId) &&
    isString(value.diagnosis) &&
    isString(value.plannedProcedure) &&
    isString(value.plannedDate) &&
    isStringArray(value.evidenceReferences) &&
    isString(value.documentProvenance) &&
    isString(value.currentCaseStatus) &&
    isString(value.sourceSystem) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isWorkflowRunDto(value: unknown): value is CaseAggregate["workflowRuns"][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.caseId) &&
    isString(value.workflowKey) &&
    isString(value.workflowName) &&
    isNullableString(value.yoxaExecutionId) &&
    isString(value.idempotencyKey) &&
    isWorkflowRunStatus(value.status) &&
    typeof value.attempt === "number" &&
    isNullableRecord(value.inputPayload) &&
    isNullableRecord(value.rawResponse) &&
    isNullableRecord(value.normalizedOutput) &&
    isNullableString(value.errorCode) &&
    isNullableString(value.errorMessage) &&
    isNullableString(value.queuedAt) &&
    isNullableString(value.startedAt) &&
    isNullableString(value.completedAt) &&
    isNullableString(value.failedAt) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isExecutionProof(value.executionProof, value.status)
  );
}

function isExecutionProofState(value: unknown): value is ExecutionProof["state"] {
  return (
    value === "resume-tracking" ||
    value === "completed" ||
    value === "failed" ||
    value === "queued" ||
    value === "triggering" ||
    value === "running" ||
    value === "waiting-for-human" ||
    value === "cancelled"
  );
}

function isExecutionProof(
  value: unknown,
  expectedCurrentStatus?: WorkflowRunStatus
): value is ExecutionProof {
  return (
    isRecord(value) &&
    isExecutionProofState(value.state) &&
    isRecord(value.durableRun) &&
    isString(value.durableRun.workflowRunId) &&
    isString(value.durableRun.idempotencyKey) &&
    isString(value.durableRun.persistedAt) &&
    isNullableString(value.durableRun.queuedAt) &&
    isRecord(value.requestDispatch) &&
    isBoolean(value.requestDispatch.dispatched) &&
    isNullableString(value.requestDispatch.dispatchedAt) &&
    isRecord(value.acceptedResponse) &&
    isBoolean(value.acceptedResponse.accepted) &&
    (value.acceptedResponse.upstreamStatusCode === null ||
      typeof value.acceptedResponse.upstreamStatusCode === "number") &&
    isNullableString(value.acceptedResponse.yoxaExecutionId) &&
    isRecord(value.currentRun) &&
    isWorkflowRunStatus(value.currentRun.status) &&
    (expectedCurrentStatus === undefined || value.currentRun.status === expectedCurrentStatus) &&
    isBoolean(value.currentRun.terminal) &&
    isNullableString(value.currentRun.startedAt) &&
    isNullableString(value.currentRun.completedAt) &&
    isNullableString(value.currentRun.failedAt) &&
    isString(value.currentRun.updatedAt)
  );
}

function isEvidenceReportDto(value: unknown): value is CaseAggregate["evidenceReports"][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.caseId) &&
    typeof value.caseVersion === "number" &&
    isString(value.agentName) &&
    isString(value.reportStatus) &&
    isRecord(value.findings) &&
    isStringArray(value.citations) &&
    isStringArray(value.unresolvedDependencies) &&
    isString(value.toolStatus) &&
    isString(value.completedAt)
  );
}

function isDependencyNodeDto(
  value: unknown
): value is NonNullable<CaseAggregate["resolutionGraph"]>["dependencyNodes"][number] {
  return (
    isRecord(value) &&
    isString(value.dependencyId) &&
    isString(value.description) &&
    isString(value.status) &&
    isStringArray(value.sources) &&
    isString(value.owner) &&
    isString(value.downstreamImpact) &&
    isString(value.nextSafeAction)
  );
}

function isAuditEventDto(value: unknown): value is CaseAggregate["auditEvents"][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.auditEventId) &&
    isString(value.caseId) &&
    typeof value.caseVersion === "number" &&
    isString(value.eventType) &&
    isRecord(value.eventData) &&
    isNullableString(value.agentRunId) &&
    isString(value.createdAt)
  );
}

function isPendingApprovalDto(value: unknown): value is CaseAggregate["pendingApproval"] {
  return value === null || (isRecord(value) && isString(value.workflowKey) && isString(value.status));
}

function isCaseAggregateReadWarning(value: unknown): value is CaseAggregate["readWarnings"][number] {
  return (
    isRecord(value) &&
    value.source === "resolutionGraphs" &&
    value.code === "READ_FAILED"
  );
}

function isLatestDecisionDto(value: unknown): value is CaseAggregate["latestDecision"] {
  return (
    value === null ||
    (isRecord(value) &&
      isString(value.id) &&
      isString(value.humanDecisionId) &&
      isString(value.caseId) &&
      typeof value.caseVersion === "number" &&
      typeof value.graphVersion === "number" &&
      isString(value.packetId) &&
      isString(value.reviewerIdentity) &&
      isString(value.reviewerRole) &&
      isString(value.outcome) &&
      isString(value.writtenReason) &&
      isStringArray(value.conditions) &&
      isNullableNumber(value.authorisedAmount) &&
      isNullableString(value.currency) &&
      isStringArray(value.validityConditions) &&
      isStringArray(value.clarificationFields) &&
      isString(value.decisionTimestamp) &&
      isString(value.createdAt))
  );
}

function isLatestPacketDto(value: unknown): value is CaseAggregate["latestPacket"] {
  return (
    value === null ||
    (isRecord(value) &&
      isString(value.id) &&
      isString(value.packetId) &&
      isString(value.caseId) &&
      typeof value.caseVersion === "number" &&
      typeof value.graphVersion === "number" &&
      isString(value.generatedAt) &&
      isNullableString(value.pdfUrl))
  );
}

function isResolutionGraphDto(value: unknown): value is CaseAggregate["resolutionGraph"] {
  return (
    value === null ||
    (isRecord(value) &&
      isString(value.id) &&
      isString(value.graphId) &&
      isString(value.caseId) &&
      typeof value.caseVersion === "number" &&
      typeof value.graphVersion === "number" &&
      isString(value.graphState) &&
      Array.isArray(value.dependencyNodes) &&
      value.dependencyNodes.every(isDependencyNodeDto) &&
      isStringArray(value.unresolvedDependencies) &&
      isStringArray(value.postAuthorisationConditions) &&
      isStringArray(value.stateReasonCodes) &&
      isString(value.nextSafeAction) &&
      isRecord(value.sourceReportVersions) &&
      isString(value.createdAt))
  );
}

function isCaseAggregate(value: unknown): value is CaseAggregate {
  return (
    isRecord(value) &&
    isCaseDto(value.case) &&
    isString(value.status) &&
    Array.isArray(value.readWarnings) &&
    value.readWarnings.every(isCaseAggregateReadWarning) &&
    Array.isArray(value.workflowRuns) &&
    value.workflowRuns.every(isWorkflowRunDto) &&
    Array.isArray(value.evidenceReports) &&
    value.evidenceReports.every(isEvidenceReportDto) &&
    isResolutionGraphDto(value.resolutionGraph) &&
    isLatestDecisionDto(value.latestDecision) &&
    isLatestPacketDto(value.latestPacket) &&
    isPendingApprovalDto(value.pendingApproval) &&
    Array.isArray(value.auditEvents) &&
    value.auditEvents.every(isAuditEventDto)
  );
}

export function unwrapCaseAggregateEnvelope(value: unknown): CaseAggregate | null {
  if (!isRecord(value) || value.success !== true || !("data" in value)) {
    return null;
  }

  const data = value.data as ApiEnvelope<unknown>["data"];
  return isCaseAggregate(data) ? data : null;
}

export function resolveCaseAggregateSnapshot(input: {
  currentData: CaseAggregate | null;
  nextData?: CaseAggregate;
  requestError?: RequestErrorState;
}): {
  caseData: CaseAggregate | null;
  loadState: Exclude<CommandCenterLoadState, "loading">;
  error: string | null;
} {
  if (input.nextData) {
    return {
      caseData: input.nextData,
      loadState: "ready",
      error: null,
    };
  }

  if (input.requestError) {
    if (input.currentData) {
      return {
        caseData: input.currentData,
        loadState: "stale",
        error: input.requestError.message,
      };
    }

    return {
      caseData: null,
      loadState: input.requestError.kind,
      error: input.requestError.message,
    };
  }

  return {
    caseData: input.currentData,
    loadState: input.currentData ? "ready" : "error",
    error: null,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const NOT_RECORDED = "NOT RECORDED";

export function formatCalendarDate(value: string | null): string {
  if (!value) {
    return "NOT RECORDED";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex >= MONTHS.length) {
    return value;
  }

  return `${Number(day)} ${MONTHS[monthIndex]} ${year}`;
}

export function getCommandCenterStatusPresentation(aggregate: CaseAggregate): StatusPresentation {
  return getStatusPresentation(aggregate.status, aggregate.resolutionGraph
    ? { graphState: aggregate.resolutionGraph.graphState }
    : null);
}

function formatExecutionProofStateLabel(state: ExecutionProof["state"]): string {
  return state.toUpperCase().replace(/-/g, " ");
}

function formatAcceptedResponseValue(proof: ExecutionProof): string {
  if (!proof.acceptedResponse.accepted) {
    return "NOT ACCEPTED";
  }

  return proof.acceptedResponse.upstreamStatusCode === null
    ? "ACCEPTED"
    : `${proof.acceptedResponse.upstreamStatusCode} ACCEPTED`;
}

function buildWorkflowProofStrip(
  proof: ExecutionProof,
  statusPresentation: WorkflowStatusPresentation
): CommandCenterProofStripItem[] {
  return [
    {
      label: "DURABLE RUN",
      value: "RECORDED",
      tone: "green",
    },
    {
      label: "REQUEST SENT",
      value: proof.requestDispatch.dispatched ? "DISPATCHED" : NOT_RECORDED,
      tone: proof.requestDispatch.dispatched ? "green" : "muted",
    },
    {
      label: "YOXA ACCEPTANCE",
      value: formatAcceptedResponseValue(proof),
      tone: proof.acceptedResponse.accepted ? "green" : "muted",
    },
    {
      label: "CURRENT RUN",
      value: statusPresentation.label,
      tone: statusPresentation.tone,
    },
  ];
}

function buildWorkflowInspector(
  run: CaseAggregate["workflowRuns"][number],
  status: WorkflowRunStatus,
  statusPresentation: WorkflowStatusPresentation
): CommandCenterWorkflowRunInspector {
  return {
    workflowName: run.workflowName,
    workflowKey: run.workflowKey,
    statusLabel: statusPresentation.label,
    proofStateLabel: formatExecutionProofStateLabel(run.executionProof.state),
    localRunId: run.id,
    yoxaExecutionId:
      run.yoxaExecutionId ?? run.executionProof.acceptedResponse.yoxaExecutionId ?? NOT_RECORDED,
    idempotencyKey: run.idempotencyKey,
    attempt: String(run.attempt),
    queuedAt: run.queuedAt ?? NOT_RECORDED,
    dispatchedAt: run.executionProof.requestDispatch.dispatchedAt ?? NOT_RECORDED,
    startedAt: run.startedAt ?? NOT_RECORDED,
    completedAt: run.completedAt ?? NOT_RECORDED,
    failedAt: run.failedAt ?? NOT_RECORDED,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    upstreamStatusCode:
      run.executionProof.acceptedResponse.upstreamStatusCode === null
        ? NOT_RECORDED
        : String(run.executionProof.acceptedResponse.upstreamStatusCode),
    acceptedResponse: formatAcceptedResponseValue(run.executionProof),
    terminalState: isTerminalWorkflowStatus(status) ? "TERMINAL" : "ACTIVE",
  };
}

function buildWorkflowRunViewModel(
  run: CaseAggregate["workflowRuns"][number]
): CommandCenterWorkflowRunViewModel {
  const status = run.executionProof.currentRun.status;
  const statusPresentation = getWorkflowStatusPresentation(status);

  return {
    ...run,
    status,
    statusPresentation,
    proofStrip: buildWorkflowProofStrip(run.executionProof, statusPresentation),
    inspector: buildWorkflowInspector(run, status, statusPresentation),
  };
}

function appendSafeCopyField(
  fields: CommandCenterCopyField[],
  field: CommandCenterCopyField | null
): void {
  if (field && field.value !== NOT_RECORDED) {
    fields.push(field);
  }
}

function getSafePacketPdfHref(pdfUrl: string): string | null {
  const trimmedPdfUrl = pdfUrl.trim();

  if (trimmedPdfUrl.length === 0) {
    return null;
  }

  if (trimmedPdfUrl.startsWith("/") && !trimmedPdfUrl.startsWith("//")) {
    try {
      const parsedRelativeUrl = new URL(trimmedPdfUrl, "https://command-center.local");
      return `${parsedRelativeUrl.pathname}${parsedRelativeUrl.search}${parsedRelativeUrl.hash}`;
    } catch {
      return null;
    }
  }

  try {
    const parsedAbsoluteUrl = new URL(trimmedPdfUrl);
    return parsedAbsoluteUrl.protocol === "https:" ? parsedAbsoluteUrl.href : null;
  } catch {
    return null;
  }
}

export function getCommandCenterPacketAction(
  packetRecord: CaseAggregate["latestPacket"]
): CommandCenterPacketAction | null {
  if (!packetRecord || !packetRecord.pdfUrl) {
    return null;
  }

  const safePacketPdfHref = getSafePacketPdfHref(packetRecord.pdfUrl);
  if (!safePacketPdfHref) {
    return null;
  }

  return {
    kind: "open",
    href: safePacketPdfHref,
    label: "OPEN PACKET PDF",
  };
}

export function getCommandCenterSafeCopyFields(
  caseRecord: CaseAggregate["case"],
  selectedWorkflowRun: CommandCenterWorkflowRunViewModel | null
): CommandCenterCopyField[] {
  const fields: CommandCenterCopyField[] = [
    { key: "caseId", label: "Case ID", value: caseRecord.caseId },
    { key: "memberId", label: "Member ID", value: caseRecord.memberId },
    { key: "policyId", label: "Policy ID", value: caseRecord.policyId },
    { key: "providerId", label: "Provider ID", value: caseRecord.hospitalId },
  ];

  if (!selectedWorkflowRun) {
    return fields;
  }

  appendSafeCopyField(fields, {
    key: "localRunId",
    label: "Local run ID",
    value: selectedWorkflowRun.inspector.localRunId,
  });
  appendSafeCopyField(fields, {
    key: "yoxaExecutionId",
    label: "Yoxa execution ID",
    value: selectedWorkflowRun.inspector.yoxaExecutionId,
  });
  appendSafeCopyField(fields, {
    key: "idempotencyKey",
    label: "Idempotency key",
    value: selectedWorkflowRun.inspector.idempotencyKey,
  });

  return fields;
}

export function getCommandCenterManualRefreshAction(input: {
  manualRefreshing: boolean;
  aggregateError: string | null;
  liveUpdateInterrupted: boolean;
}): CommandCenterManualRefreshAction {
  if (input.manualRefreshing) {
    return {
      intent: "aggregate-read",
      label: "REFRESHING AGGREGATE...",
    };
  }

  if (input.aggregateError || input.liveUpdateInterrupted) {
    return {
      intent: "aggregate-read",
      label: "RETRY AGGREGATE FETCH",
    };
  }

  return {
    intent: "aggregate-read",
    label: "REFRESH AGGREGATE",
  };
}

export function getCommandCenterCopyButtonLabel(
  fieldKey: CommandCenterCopyField["key"],
  copiedFieldKey: CommandCenterCopyField["key"] | null
): "COPY" | "COPIED" {
  return copiedFieldKey === fieldKey ? "COPIED" : "COPY";
}

export function getCommandCenterInspectorSelection(input: {
  currentSelectedRunId: string | null;
  nextSelectedRunId?: string | null;
  closeInspector?: boolean;
  closeReason?: "button" | "escape";
  availableRunIds: string[];
}): string | null {
  if (input.closeInspector) {
    return null;
  }

  if (input.nextSelectedRunId !== undefined) {
    return input.nextSelectedRunId && input.availableRunIds.includes(input.nextSelectedRunId)
      ? input.nextSelectedRunId
      : null;
  }

  return input.currentSelectedRunId && input.availableRunIds.includes(input.currentSelectedRunId)
    ? input.currentSelectedRunId
    : null;
}

export function buildCommandCenterViewModel(aggregate: CaseAggregate): CommandCenterViewModel {
  const factors: string[] = [];
  const resolutionGraphAvailability = aggregate.resolutionGraph
    ? "available"
    : aggregate.readWarnings.some(
          (readWarning) =>
            readWarning.source === "resolutionGraphs" && readWarning.code === "READ_FAILED"
        )
      ? "unavailable"
      : "noRecord";

  const writtenReason = aggregate.latestDecision?.writtenReason?.trim();
  if (writtenReason) {
    factors.push(writtenReason);
  }

  for (const reasonCode of aggregate.resolutionGraph?.stateReasonCodes ?? []) {
    factors.push(`Reason code: ${reasonCode}`);
  }

  for (const report of aggregate.evidenceReports) {
    factors.push(`Evidence status: ${report.agentName} — ${report.reportStatus}`);
  }

  const workflowRuns = aggregate.workflowRuns.map(buildWorkflowRunViewModel);

  return {
    caseRecord: aggregate.case,
    status: aggregate.status,
    evidence: {
      count: aggregate.evidenceReports.length,
      provenance: aggregate.case.documentProvenance,
      reports: aggregate.evidenceReports,
    },
    decision: {
      record: aggregate.latestDecision,
      factors,
    },
    workflow: {
      runs: workflowRuns,
      shouldPoll: shouldPollWorkflowRuns(workflowRuns),
      activity: aggregate.auditEvents.map((auditEvent) => ({
        id: auditEvent.id,
        eventType: auditEvent.eventType,
        recordedAt: auditEvent.createdAt,
        actor: auditEvent.agentRunId ?? "SYSTEM",
      })),
    },
    audit: {
      events: aggregate.auditEvents,
    },
    packet: {
      record: aggregate.latestPacket,
    },
    approval: {
      pending: aggregate.pendingApproval,
    },
    resolutionGraph: {
      record: aggregate.resolutionGraph,
      availability: resolutionGraphAvailability,
    },
  };
}
