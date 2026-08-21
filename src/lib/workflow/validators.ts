/* ======================================================
   YOXA — Workflow Validators
   Input validation, version conflict detection, idempotency
   ====================================================== */

import { v4 as uuidv4 } from "uuid";
import type { CaseRecord } from "@/types/workflow";

// ─── Dual-key activation validation ───
export interface ActivationValidation {
  isValid: boolean;
  status: "ACTIVATED_VALIDATED" | "WAITING_FOR_ACTIVATION" | "HUMAN_REVIEW_REQUIRED";
  verified_fields: string[];
  missing_fields: string[];
  conflicts: string[];
  reason_codes: string[];
}

export function validateActivation(caseRecord: CaseRecord): ActivationValidation {
  const verified: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: string[] = [];

  // Check dual-key activation
  if (caseRecord.patient_consent_status) {
    verified.push("patient_consent");
  } else {
    missing.push("patient_consent");
    reasons.push("PATIENT_CONSENT_MISSING");
  }

  if (caseRecord.hospital_clinical_confirmation_status) {
    verified.push("hospital_clinical_confirmation");
  } else {
    missing.push("hospital_clinical_confirmation");
    reasons.push("HOSPITAL_CONFIRMATION_MISSING");
  }

  // If either activation key is missing, stop here
  if (missing.length > 0) {
    return {
      isValid: false,
      status: "WAITING_FOR_ACTIVATION",
      verified_fields: verified,
      missing_fields: missing,
      conflicts: [],
      reason_codes: reasons,
    };
  }

  // Validate identity fields
  const requiredFields: Array<{ field: keyof CaseRecord; name: string }> = [
    { field: "member_id", name: "member_id" },
    { field: "policy_id", name: "policy_id" },
    { field: "hospital_id", name: "hospital_id" },
    { field: "diagnosis", name: "diagnosis" },
    { field: "planned_procedure", name: "planned_procedure" },
    { field: "planned_date", name: "planned_date" },
  ];

  for (const { field, name } of requiredFields) {
    const value = caseRecord[field];
    if (value && value !== "") {
      verified.push(name);
    } else {
      missing.push(name);
      reasons.push(`${name.toUpperCase()}_MISSING`);
    }
  }

  // Validate evidence references
  if (caseRecord.evidence_references && caseRecord.evidence_references.length > 0) {
    verified.push("evidence_references");
  } else {
    missing.push("evidence_references");
    reasons.push("EVIDENCE_REFERENCES_MISSING");
  }

  // Validate document provenance
  if (caseRecord.document_provenance === "VERIFIED") {
    verified.push("document_provenance");
  } else {
    conflicts.push("document_provenance_unverified");
    reasons.push("DOCUMENT_PROVENANCE_UNVERIFIED");
  }

  // If there are identity/evidence issues, route to human review
  if (missing.length > 0 || conflicts.length > 0) {
    return {
      isValid: false,
      status: "HUMAN_REVIEW_REQUIRED",
      verified_fields: verified,
      missing_fields: missing,
      conflicts,
      reason_codes: reasons,
    };
  }

  return {
    isValid: true,
    status: "ACTIVATED_VALIDATED",
    verified_fields: verified,
    missing_fields: [],
    conflicts: [],
    reason_codes: ["ACTIVATION_VALIDATED"],
  };
}

// ─── Idempotency key generators ───
export function activationIdempotencyKey(caseId: string, version: number): string {
  return `activation_validation:${caseId}:${version}`;
}

export function resolutionGraphIdempotencyKey(
  caseId: string,
  version: number,
  reportVersions: string
): string {
  return `resolution_graph:${caseId}:${version}:${reportVersions}`;
}

export function blockerIdempotencyKey(
  caseId: string,
  graphVersion: number,
  dependencyIds: string[],
  status: string
): string {
  return `blocker:${caseId}:${graphVersion}:${dependencyIds.join(",")}:${status}`;
}

export function humanOutcomeIdempotencyKey(
  caseId: string,
  graphVersion: number,
  packetId: string,
  timestamp: string
): string {
  return `human_outcome:${caseId}:${graphVersion}:${packetId}:${timestamp}`;
}

// ─── Generate IDs ───
export function generateAuditEventId(caseId: string, eventType: string): string {
  return `AUD-${caseId.replace("CASE-", "")}-${eventType}`;
}

export function generateGraphId(caseId: string): string {
  return `RG-${caseId.replace("CASE-", "")}`;
}

export function generatePacketId(caseId: string): string {
  return `PKT-${caseId.replace("CASE-", "")}-${Date.now()}`;
}

export function generateDecisionId(caseId: string): string {
  return `HDO-${caseId.replace("CASE-", "")}`;
}

export function generateAgentRunId(): string {
  return `AGENT-${uuidv4().slice(0, 8)}`;
}

// ─── Human Decision Validation ───
export interface HumanDecisionValidation {
  isValid: boolean;
  errors: string[];
}

export function validateHumanDecision(decision: {
  reviewer_identity?: string;
  reviewer_role?: string;
  outcome?: string;
  written_reason?: string;
  decision_timestamp?: string;
  authorised_amount?: number;
  currency?: string;
  validity_conditions?: string[];
  clarification_fields?: string[];
}): HumanDecisionValidation {
  const errors: string[] = [];

  if (!decision.reviewer_identity) errors.push("reviewer_identity is required");
  if (!decision.reviewer_role) errors.push("reviewer_role is required");
  if (!decision.outcome) errors.push("outcome is required");
  if (!decision.written_reason) errors.push("written_reason is required");
  if (!decision.decision_timestamp) errors.push("decision_timestamp is required");

  const validOutcomes = ["AUTHORISE", "REQUEST_CLARIFICATION", "DECLINE_OR_REDUCE"];
  if (decision.outcome && !validOutcomes.includes(decision.outcome)) {
    errors.push(`outcome must be one of: ${validOutcomes.join(", ")}`);
  }

  if (decision.outcome === "AUTHORISE") {
    if (!decision.authorised_amount && decision.authorised_amount !== 0) {
      errors.push("authorised_amount is required for AUTHORISE outcome");
    }
    if (!decision.currency) {
      errors.push("currency is required for AUTHORISE outcome");
    }
  }

  if (decision.outcome === "REQUEST_CLARIFICATION") {
    if (!decision.clarification_fields || decision.clarification_fields.length === 0) {
      errors.push("clarification_fields required for REQUEST_CLARIFICATION");
    }
  }

  if (decision.outcome === "DECLINE_OR_REDUCE") {
    if (!decision.written_reason || decision.written_reason.length < 10) {
      errors.push("written_reason must be substantive for DECLINE_OR_REDUCE");
    }
  }

  return { isValid: errors.length === 0, errors };
}
