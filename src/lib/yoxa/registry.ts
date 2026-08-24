/* ======================================================
   YOXA — Server Workflow Registry
   ====================================================== */

import { env } from "@/config/env";
import type { YoxaWorkflowKey, YoxaWorkflowDefinition } from "./types";

export const workflowRegistry: Record<YoxaWorkflowKey, YoxaWorkflowDefinition> = {
  intake: {
    key: "intake",
    name: env.yoxa.intake.name,
    triggerUrl: env.yoxa.intake.triggerUrl,
    secret: env.yoxa.intake.secret,
  },
  preauth: {
    key: "preauth",
    name: env.yoxa.preauth.name,
    triggerUrl: env.yoxa.preauth.triggerUrl,
    secret: env.yoxa.preauth.secret,
  },
  materialChange: {
    key: "materialChange",
    name: env.yoxa.materialChange.name,
    triggerUrl: env.yoxa.materialChange.triggerUrl,
    secret: env.yoxa.materialChange.secret,
  },
  discharge: {
    key: "discharge",
    name: env.yoxa.discharge.name,
    triggerUrl: env.yoxa.discharge.triggerUrl,
    secret: env.yoxa.discharge.secret,
  },
  settlement: {
    key: "settlement",
    name: env.yoxa.settlement.name,
    triggerUrl: env.yoxa.settlement.triggerUrl,
    secret: env.yoxa.settlement.secret,
  },
  appeal: {
    key: "appeal",
    name: env.yoxa.appeal.name,
    triggerUrl: env.yoxa.appeal.triggerUrl,
    secret: env.yoxa.appeal.secret,
  },
};

type WorkflowConfigurationField = "triggerUrl" | "secret";
type WorkflowConfigurationReason = "missing" | "invalid_url";

export class WorkflowConfigurationError extends Error {
  readonly code = "INVALID_WORKFLOW_CONFIGURATION";

  constructor(
    public readonly workflowKey: YoxaWorkflowKey,
    public readonly field: WorkflowConfigurationField,
    public readonly reason: WorkflowConfigurationReason,
  ) {
    super(buildConfigurationErrorMessage(workflowKey, field, reason));
    this.name = "WorkflowConfigurationError";
  }
}

function buildConfigurationErrorMessage(
  workflowKey: YoxaWorkflowKey,
  field: WorkflowConfigurationField,
  reason: WorkflowConfigurationReason,
): string {
  if (field === "secret") {
    return `Workflow "${workflowKey}" is misconfigured: secret is missing.`;
  }

  if (reason === "missing") {
    return `Workflow "${workflowKey}" is misconfigured: triggerUrl is missing.`;
  }

  return `Workflow "${workflowKey}" is misconfigured: triggerUrl must be a valid http(s) URL.`;
}

function requireConfiguredValue(
  workflowKey: YoxaWorkflowKey,
  field: WorkflowConfigurationField,
  value: string,
): string {
  if (value.trim().length === 0) {
    throw new WorkflowConfigurationError(workflowKey, field, "missing");
  }

  return value;
}

function requireTriggerUrl(workflowKey: YoxaWorkflowKey, value: string): string {
  const triggerUrl = requireConfiguredValue(workflowKey, "triggerUrl", value);

  try {
    const parsed = new URL(triggerUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new WorkflowConfigurationError(workflowKey, "triggerUrl", "invalid_url");
  }

  return triggerUrl;
}

function validateWorkflowDefinition(def: YoxaWorkflowDefinition): YoxaWorkflowDefinition {
  return {
    ...def,
    triggerUrl: requireTriggerUrl(def.key, def.triggerUrl),
    secret: requireConfiguredValue(def.key, "secret", def.secret),
  };
}

export function getWorkflowDefinition(key: YoxaWorkflowKey): YoxaWorkflowDefinition {
  const def = workflowRegistry[key];
  if (!def) {
    throw new Error(`Unknown workflow key: ${key}`);
  }

  return validateWorkflowDefinition(def);
}
