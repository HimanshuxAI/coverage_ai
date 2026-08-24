import type { ApiEnvelope, CaseAggregate } from "./contracts";

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
    runs: CaseAggregate["workflowRuns"];
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
  resolutionGraph: CaseAggregate["resolutionGraph"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCaseAggregate(value: unknown): value is CaseAggregate {
  return (
    isRecord(value) &&
    isRecord(value.case) &&
    Array.isArray(value.workflowRuns) &&
    Array.isArray(value.evidenceReports) &&
    Array.isArray(value.auditEvents)
  );
}

export function unwrapCaseAggregateEnvelope(value: unknown): CaseAggregate | null {
  if (!isRecord(value) || value.success !== true || !("data" in value)) {
    return null;
  }

  const data = value.data as ApiEnvelope<unknown>["data"];
  return isCaseAggregate(data) ? data : null;
}

export function buildCommandCenterViewModel(aggregate: CaseAggregate): CommandCenterViewModel {
  const factors: string[] = [];

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
      runs: aggregate.workflowRuns,
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
    resolutionGraph: aggregate.resolutionGraph,
  };
}
