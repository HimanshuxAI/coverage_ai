import { describe, expect, it } from "vitest";

import type { ApiEnvelope, CaseAggregate } from "./contracts";
import {
  buildCommandCenterViewModel,
  formatCalendarDate,
  getCommandCenterStatusPresentation,
  resolveCaseAggregateSnapshot,
  unwrapCaseAggregateEnvelope,
} from "./command-center";
import { buildProcessRequestBody } from "@/lib/yoxa/process-request";

function buildAggregate(overrides: Partial<CaseAggregate> = {}): CaseAggregate {
  return {
    case: {
      id: "case-row-1",
      caseId: "CASE-CT-REAL-001",
      caseVersion: 7,
      patientConsentStatus: true,
      patientConsentTimestamp: "2026-08-24T10:00:00.000Z",
      hospitalClinicalConfirmationStatus: true,
      hospitalConfirmationTimestamp: "2026-08-24T11:00:00.000Z",
      memberId: "MEM-001",
      policyId: "POL-001",
      hospitalId: "HOSP-001",
      diagnosis: "Gallstones",
      plannedProcedure: "Laparoscopic cholecystectomy",
      plannedDate: "2026-08-28",
      evidenceReferences: ["evidence://scan-1", "evidence://scan-2"],
      documentProvenance: "member-upload",
      currentCaseStatus: "DECISION_READY",
      sourceSystem: "manual-seed",
      createdAt: "2026-08-24T09:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    },
    status: "DECISION_READY",
    readWarnings: [],
    workflowRuns: [],
    evidenceReports: [],
    resolutionGraph: null,
    latestDecision: null,
    latestPacket: null,
    pendingApproval: null,
    auditEvents: [],
    ...overrides,
  };
}

describe("unwrapCaseAggregateEnvelope", () => {
  it("accepts only the success envelope shape and returns json.data", () => {
    const aggregate = buildAggregate();
    const envelope: ApiEnvelope<CaseAggregate> = {
      success: true,
      data: aggregate,
    };

    expect(unwrapCaseAggregateEnvelope(envelope)).toBe(aggregate);
    expect(unwrapCaseAggregateEnvelope(aggregate)).toBeNull();
  });

  it("rejects malformed aggregates even when top-level arrays exist", () => {
    const aggregate = buildAggregate();
    const malformedWorkflowEnvelope = {
      success: true,
      data: {
        ...aggregate,
        workflowRuns: [{ id: "run-1" }],
      },
    };
    const malformedEvidenceEnvelope = {
      success: true,
      data: {
        ...aggregate,
        evidenceReports: [{ id: "report-1", agentName: "policy" }],
      },
    };
    const malformedAuditEnvelope = {
      success: true,
      data: {
        ...aggregate,
        auditEvents: [{ id: "audit-1", eventType: "ANY_EVENT" }],
      },
    };

    expect(unwrapCaseAggregateEnvelope(malformedWorkflowEnvelope)).toBeNull();
    expect(unwrapCaseAggregateEnvelope(malformedEvidenceEnvelope)).toBeNull();
    expect(unwrapCaseAggregateEnvelope(malformedAuditEnvelope)).toBeNull();
  });

  it("rejects workflow runs that omit executionProof or contain malformed proof", () => {
    const aggregate = buildAggregate();
    const missingProofEnvelope = {
      success: true,
      data: {
        ...aggregate,
        workflowRuns: [
          {
            id: "run-1",
            caseId: "CASE-CT-REAL-001",
            workflowKey: "preauth",
            workflowName: "Pre-auth",
            yoxaExecutionId: "yoxa-run-1",
            idempotencyKey: "idem-1",
            status: "RUNNING",
            attempt: 1,
            inputPayload: { workflowKey: "preauth" },
            rawResponse: null,
            normalizedOutput: null,
            errorCode: null,
            errorMessage: null,
            queuedAt: "2026-08-24T10:30:00.000Z",
            startedAt: "2026-08-24T10:31:00.000Z",
            completedAt: null,
            failedAt: null,
            createdAt: "2026-08-24T10:30:00.000Z",
            updatedAt: "2026-08-24T10:32:00.000Z",
          },
        ],
      },
    };
    const malformedProofEnvelope = {
      success: true,
      data: {
        ...aggregate,
        workflowRuns: [
          {
            id: "run-1",
            caseId: "CASE-CT-REAL-001",
            workflowKey: "preauth",
            workflowName: "Pre-auth",
            yoxaExecutionId: "yoxa-run-1",
            idempotencyKey: "idem-1",
            status: "RUNNING",
            attempt: 1,
            inputPayload: { workflowKey: "preauth" },
            rawResponse: null,
            normalizedOutput: null,
            errorCode: null,
            errorMessage: null,
            queuedAt: "2026-08-24T10:30:00.000Z",
            startedAt: "2026-08-24T10:31:00.000Z",
            completedAt: null,
            failedAt: null,
            createdAt: "2026-08-24T10:30:00.000Z",
            updatedAt: "2026-08-24T10:32:00.000Z",
            executionProof: {
              state: "running",
              durableRun: {
                workflowRunId: "run-1",
                idempotencyKey: "idem-1",
                persistedAt: "2026-08-24T10:30:00.000Z",
                queuedAt: "2026-08-24T10:30:00.000Z",
              },
              requestDispatch: {
                dispatched: "yes",
                dispatchedAt: "2026-08-24T10:31:00.000Z",
              },
              acceptedResponse: {
                accepted: true,
                upstreamStatusCode: 202,
                yoxaExecutionId: "yoxa-run-1",
              },
              currentRun: {
                status: "RUNNING",
                terminal: false,
                startedAt: "2026-08-24T10:31:00.000Z",
                completedAt: null,
                failedAt: null,
                updatedAt: "2026-08-24T10:32:00.000Z",
              },
            },
          },
        ],
      },
    };

    expect(unwrapCaseAggregateEnvelope(missingProofEnvelope)).toBeNull();
    expect(unwrapCaseAggregateEnvelope(malformedProofEnvelope)).toBeNull();
  });

  it("accepts workflow runs with a valid executionProof contract", () => {
    const aggregate = buildAggregate();
    const validEnvelope = {
      success: true,
      data: {
        ...aggregate,
        workflowRuns: [
          {
            id: "run-1",
            caseId: "CASE-CT-REAL-001",
            workflowKey: "preauth",
            workflowName: "Pre-auth",
            yoxaExecutionId: "yoxa-run-1",
            idempotencyKey: "idem-1",
            status: "RUNNING",
            attempt: 1,
            inputPayload: { workflowKey: "preauth" },
            rawResponse: null,
            normalizedOutput: null,
            errorCode: null,
            errorMessage: null,
            queuedAt: "2026-08-24T10:30:00.000Z",
            startedAt: "2026-08-24T10:31:00.000Z",
            completedAt: null,
            failedAt: null,
            createdAt: "2026-08-24T10:30:00.000Z",
            updatedAt: "2026-08-24T10:32:00.000Z",
            executionProof: {
              state: "running",
              durableRun: {
                workflowRunId: "run-1",
                idempotencyKey: "idem-1",
                persistedAt: "2026-08-24T10:30:00.000Z",
                queuedAt: "2026-08-24T10:30:00.000Z",
              },
              requestDispatch: {
                dispatched: true,
                dispatchedAt: "2026-08-24T10:31:00.000Z",
              },
              acceptedResponse: {
                accepted: true,
                upstreamStatusCode: 202,
                yoxaExecutionId: "yoxa-run-1",
              },
              currentRun: {
                status: "RUNNING",
                terminal: false,
                startedAt: "2026-08-24T10:31:00.000Z",
                completedAt: null,
                failedAt: null,
                updatedAt: "2026-08-24T10:32:00.000Z",
              },
            },
          },
        ],
      },
    } satisfies ApiEnvelope<CaseAggregate>;

    expect(unwrapCaseAggregateEnvelope(validEnvelope)?.workflowRuns[0].executionProof).toMatchObject({
      state: "running",
      acceptedResponse: {
        accepted: true,
        upstreamStatusCode: 202,
      },
    });
  });

  it("rejects malformed dependency nodes and accepts valid dependency node DTOs", () => {
    const aggregate = buildAggregate();
    const malformedDependencyNodeEnvelope = {
      success: true,
      data: {
        ...aggregate,
        resolutionGraph: {
          id: "graph-row-1",
          graphId: "graph-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          graphVersion: 3,
          graphState: "DECISION_READY",
          dependencyNodes: [
            {
              dependencyId: "dep-1",
              description: "Policy evidence collected",
              status: "RESOLVED",
              sources: [123],
              owner: "policy",
              downstreamImpact: "ready-for-review",
              nextSafeAction: "Proceed to human review",
            },
          ],
          unresolvedDependencies: [],
          postAuthorisationConditions: [],
          stateReasonCodes: ["POLICY_CLEAR"],
          nextSafeAction: "Prepare decision packet",
          sourceReportVersions: { policy: "policy-v1" },
          createdAt: "2026-08-24T10:50:00.000Z",
        },
      },
    };
    const validDependencyNodeEnvelope = {
      success: true,
      data: {
        ...aggregate,
        resolutionGraph: {
          id: "graph-row-1",
          graphId: "graph-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          graphVersion: 3,
          graphState: "DECISION_READY",
          dependencyNodes: [
            {
              dependencyId: "dep-1",
              description: "Policy evidence collected",
              status: "RESOLVED",
              sources: ["policy"],
              owner: "policy",
              downstreamImpact: "ready-for-review",
              nextSafeAction: "Proceed to human review",
            },
          ],
          unresolvedDependencies: [],
          postAuthorisationConditions: [],
          stateReasonCodes: ["POLICY_CLEAR"],
          nextSafeAction: "Prepare decision packet",
          sourceReportVersions: { policy: "policy-v1" },
          createdAt: "2026-08-24T10:50:00.000Z",
        },
      },
    } satisfies ApiEnvelope<CaseAggregate>;

    expect(unwrapCaseAggregateEnvelope(malformedDependencyNodeEnvelope)).toBeNull();
    expect(unwrapCaseAggregateEnvelope(validDependencyNodeEnvelope)?.resolutionGraph?.dependencyNodes[0]).toMatchObject({
      dependencyId: "dep-1",
      sources: ["policy"],
      owner: "policy",
    });
  });

  it("rejects malformed read warnings and accepts typed read warnings", () => {
    const aggregate = buildAggregate();
    const malformedReadWarningEnvelope = {
      success: true,
      data: {
        ...aggregate,
        readWarnings: [{ source: "resolutionGraphs", code: "WRONG_CODE" }],
      },
    };
    const validReadWarningEnvelope = {
      success: true,
      data: {
        ...aggregate,
        readWarnings: [{ source: "resolutionGraphs", code: "READ_FAILED" }],
      },
    };

    expect(unwrapCaseAggregateEnvelope(malformedReadWarningEnvelope)).toBeNull();
    expect(unwrapCaseAggregateEnvelope(validReadWarningEnvelope)?.readWarnings).toEqual([
      { source: "resolutionGraphs", code: "READ_FAILED" },
    ]);
  });

  it("accepts an explicit null latestPacket.pdfUrl but rejects a missing pdfUrl field", () => {
    const aggregate = buildAggregate({
      latestPacket: {
        id: "packet-row-1",
        packetId: "packet-1",
        caseId: "CASE-CT-REAL-001",
        caseVersion: 7,
        graphVersion: 3,
        generatedAt: "2026-08-24T10:53:00.000Z",
        pdfUrl: null,
      },
    });
    const validEnvelope = {
      success: true,
      data: aggregate,
    } satisfies ApiEnvelope<CaseAggregate>;
    const malformedEnvelope = {
      success: true,
      data: {
        ...aggregate,
        latestPacket: {
          id: "packet-row-1",
          packetId: "packet-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          graphVersion: 3,
          generatedAt: "2026-08-24T10:53:00.000Z",
        },
      },
    };

    expect(unwrapCaseAggregateEnvelope(validEnvelope)?.latestPacket?.pdfUrl).toBeNull();
    expect(unwrapCaseAggregateEnvelope(malformedEnvelope)).toBeNull();
  });
});

describe("resolveCaseAggregateSnapshot", () => {
  it("keeps the last good aggregate but marks it stale when a refresh fails", () => {
    const aggregate = buildAggregate();

    expect(
      resolveCaseAggregateSnapshot({
        currentData: aggregate,
        requestError: { kind: "error", message: "Aggregate refresh failed." },
      })
    ).toEqual({
      caseData: aggregate,
      loadState: "stale",
      error: "Aggregate refresh failed.",
    });
  });

  it("keeps initial failures without data as unavailable or no-record states", () => {
    expect(
      resolveCaseAggregateSnapshot({
        currentData: null,
        requestError: { kind: "error", message: "Aggregate refresh failed." },
      })
    ).toEqual({
      caseData: null,
      loadState: "error",
      error: "Aggregate refresh failed.",
    });

    expect(
      resolveCaseAggregateSnapshot({
        currentData: null,
        requestError: { kind: "noRecord", message: "Case not found." },
      })
    ).toEqual({
      caseData: null,
      loadState: "noRecord",
      error: "Case not found.",
    });
  });
});

describe("formatCalendarDate", () => {
  it("formats YYYY-MM-DD values without timezone shifts", () => {
    expect(formatCalendarDate("2026-08-28")).toBe("28 Aug 2026");
  });
});

describe("buildCommandCenterViewModel", () => {
  it("prefers live aggregate records for decision, graph, evidence, workflow, audit, and packet state", () => {
    const aggregate = buildAggregate({
      status: "AUTHORISED_BY_HUMAN",
      case: {
        ...buildAggregate().case,
        currentCaseStatus: "AUTHORISED_BY_HUMAN",
        documentProvenance: "hospital-portal",
      },
      workflowRuns: [
        {
          id: "run-1",
          caseId: "CASE-CT-REAL-001",
          workflowKey: "preauth",
          workflowName: "Pre-auth",
          yoxaExecutionId: "yoxa-run-1",
          idempotencyKey: "idem-1",
          status: "RUNNING",
          attempt: 2,
          inputPayload: { workflowKey: "preauth" },
          rawResponse: null,
          normalizedOutput: null,
          errorCode: null,
          errorMessage: null,
          queuedAt: "2026-08-24T10:30:00.000Z",
          startedAt: "2026-08-24T10:31:00.000Z",
          completedAt: null,
          failedAt: null,
          createdAt: "2026-08-24T10:30:00.000Z",
          updatedAt: "2026-08-24T10:32:00.000Z",
          executionProof: {
            state: "running",
            durableRun: {
              workflowRunId: "run-1",
              idempotencyKey: "idem-1",
              persistedAt: "2026-08-24T10:30:00.000Z",
              queuedAt: "2026-08-24T10:30:00.000Z",
            },
            requestDispatch: {
              dispatched: true,
              dispatchedAt: "2026-08-24T10:31:00.000Z",
            },
            acceptedResponse: {
              accepted: true,
              upstreamStatusCode: 202,
              yoxaExecutionId: "yoxa-run-1",
            },
            currentRun: {
              status: "RUNNING",
              terminal: false,
              startedAt: "2026-08-24T10:31:00.000Z",
              completedAt: null,
              failedAt: null,
              updatedAt: "2026-08-24T10:32:00.000Z",
            },
          },
        },
      ],
      evidenceReports: [
        {
          id: "report-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          agentName: "policy",
          reportStatus: "COMPLETE",
          findings: {
            policy_active: true,
            member_eligible: true,
            procedure_covered: true,
            original_policy_inception: "2024-01-01",
            planned_admission_date: "2026-08-28",
            waiting_period_months: 12,
            waiting_period_satisfied: true,
            continuous_coverage_confirmed: true,
            applicable_exclusion_found: false,
            applicable_pre_existing_disease_restriction_found: false,
            network_hospital_confirmed: true,
            hospital_id: "HOSP-001",
            room_eligibility: "Single private room",
            procedure_sub_limit: 100000,
            co_payment_rate: 0,
            deductible_amount: 0,
          },
          citations: ["policy.pdf#page=3"],
          unresolvedDependencies: [],
          toolStatus: "SUCCESS",
          completedAt: "2026-08-24T10:45:00.000Z",
        },
        {
          id: "report-2",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          agentName: "clinical",
          reportStatus: "PENDING_REVIEW",
          findings: {
            diagnosis: "Gallstones",
            planned_procedure: "Laparoscopic cholecystectomy",
            clinical_record_version: "v3",
            doctor_recommendation_confirmed: true,
            diagnostic_support_confirmed: true,
            medical_necessity_supported: true,
            planned_pre_authorisation_ready: true,
            post_authorisation_conditions: [],
          },
          citations: ["clinical.pdf#page=4"],
          unresolvedDependencies: ["dep-2"],
          toolStatus: "SUCCESS",
          completedAt: "2026-08-24T10:46:00.000Z",
        },
      ],
      resolutionGraph: {
        id: "graph-row-1",
        graphId: "graph-1",
        caseId: "CASE-CT-REAL-001",
        caseVersion: 7,
        graphVersion: 3,
        graphState: "DECISION_READY",
        dependencyNodes: [],
        unresolvedDependencies: [],
        postAuthorisationConditions: [],
        stateReasonCodes: ["POLICY_CLEAR", "CLINICAL_CLEAR"],
        nextSafeAction: "Prepare decision packet",
        sourceReportVersions: { policy: "policy-v1" },
        createdAt: "2026-08-24T10:50:00.000Z",
      },
      latestDecision: {
        id: "decision-row-1",
        humanDecisionId: "decision-1",
        caseId: "CASE-CT-REAL-001",
        caseVersion: 7,
        graphVersion: 3,
        packetId: "packet-1",
        reviewerIdentity: "judge@example.com",
        reviewerRole: "Medical Director",
        outcome: "AUTHORISE",
        writtenReason: "All required evidence is complete.",
        conditions: ["Notify hospital desk"],
        authorisedAmount: 85000,
        currency: "INR",
        validityConditions: ["Admit within 7 days"],
        clarificationFields: [],
        decisionTimestamp: "2026-08-24T10:55:00.000Z",
        createdAt: "2026-08-24T10:55:00.000Z",
      },
      latestPacket: {
        id: "packet-row-1",
        packetId: "packet-1",
        caseId: "CASE-CT-REAL-001",
        caseVersion: 7,
        graphVersion: 3,
        generatedAt: "2026-08-24T10:53:00.000Z",
        pdfUrl: "https://example.com/packet.pdf",
      },
      pendingApproval: {
        workflowKey: "preauth",
        status: "WAITING_FOR_HUMAN",
      },
      auditEvents: [
        {
          id: "audit-row-1",
          auditEventId: "audit-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          eventType: "WORKFLOW_TRIGGERED_PREAUTH",
          eventData: { workflow_key: "preauth" },
          agentRunId: "run-1",
          createdAt: "2026-08-24T10:31:30.000Z",
        },
      ],
    });

    const viewModel = buildCommandCenterViewModel(aggregate);

    expect(viewModel.caseRecord.documentProvenance).toBe("hospital-portal");
    expect(viewModel.evidence.count).toBe(2);
    expect(viewModel.decision.record?.outcome).toBe("AUTHORISE");
    expect(viewModel.decision.record?.authorisedAmount).toBe(85000);
    expect(viewModel.decision.factors).toEqual([
      "All required evidence is complete.",
      "Reason code: POLICY_CLEAR",
      "Reason code: CLINICAL_CLEAR",
      "Evidence status: policy — COMPLETE",
      "Evidence status: clinical — PENDING_REVIEW",
    ]);
    expect(viewModel.workflow.runs[0]).toMatchObject({
      id: "run-1",
      workflowKey: "preauth",
      status: "RUNNING",
      yoxaExecutionId: "yoxa-run-1",
      startedAt: "2026-08-24T10:31:00.000Z",
    });
    expect(viewModel.audit.events[0]).toMatchObject({
      eventType: "WORKFLOW_TRIGGERED_PREAUTH",
      createdAt: "2026-08-24T10:31:30.000Z",
    });
    expect(viewModel.packet.record?.packetId).toBe("packet-1");
    expect(viewModel.approval.pending?.status).toBe("WAITING_FOR_HUMAN");
    expect(viewModel.resolutionGraph.availability).toBe("available");
  });

  it("keeps empty related records explicit instead of inventing operational state", () => {
    const viewModel = buildCommandCenterViewModel(buildAggregate());

    expect(viewModel.evidence.count).toBe(0);
    expect(viewModel.decision.record).toBeNull();
    expect(viewModel.decision.factors).toEqual([]);
    expect(viewModel.workflow.runs).toEqual([]);
    expect(viewModel.audit.events).toEqual([]);
    expect(viewModel.packet.record).toBeNull();
    expect(viewModel.approval.pending).toBeNull();
    expect(viewModel.resolutionGraph.availability).toBe("noRecord");
  });

  it("never synthesizes decision or execution records from presentation defaults", () => {
    const viewModel = buildCommandCenterViewModel(
      buildAggregate({
        status: "AUTHORISED_BY_HUMAN",
        case: {
          ...buildAggregate().case,
          currentCaseStatus: "AUTHORISED_BY_HUMAN",
        },
      })
    );

    expect(viewModel.decision.record).toBeNull();
    expect(viewModel.workflow.runs).toEqual([]);
    expect(viewModel.audit.events).toEqual([]);
    expect(viewModel.packet.record).toBeNull();
    expect(viewModel.approval.pending).toBeNull();
  });

  it("marks the resolution graph as unavailable when the aggregate carries a read warning", () => {
    const viewModel = buildCommandCenterViewModel(
      buildAggregate({
        readWarnings: [{ source: "resolutionGraphs", code: "READ_FAILED" }],
      })
    );

    expect(viewModel.resolutionGraph.record).toBeNull();
    expect(viewModel.resolutionGraph.availability).toBe("unavailable");
  });
});

describe("getCommandCenterStatusPresentation", () => {
  it("uses the aggregate resolution graph when deriving the next process action", () => {
    const presentation = getCommandCenterStatusPresentation(
      buildAggregate({
        status: "WAITING_FOR_EVIDENCE",
        case: {
          ...buildAggregate().case,
          currentCaseStatus: "WAITING_FOR_EVIDENCE",
        },
        resolutionGraph: {
          id: "graph-row-1",
          graphId: "graph-1",
          caseId: "CASE-CT-REAL-001",
          caseVersion: 7,
          graphVersion: 3,
          graphState: "RESOLVABLE_MISSING_EVIDENCE",
          dependencyNodes: [],
          unresolvedDependencies: ["dep-1"],
          postAuthorisationConditions: [],
          stateReasonCodes: ["RESOLVABLE_EVIDENCE_GAPS"],
          nextSafeAction: "REQUEST_MINIMUM_EVIDENCE",
          sourceReportVersions: { policy: "policy-v1" },
          createdAt: "2026-08-24T10:50:00.000Z",
        },
      })
    );

    expect(presentation.nextActionLabel).toBe("RE-EVALUATE CASE");
    expect(presentation.targetWorkflowKey).toBe("materialChange");
    expect(buildProcessRequestBody(presentation.targetWorkflowKey!)).toEqual({
      workflowKey: "materialChange",
    });
  });
});
