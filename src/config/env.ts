/* ======================================================
   COVERAGE TWIN — Central Environment Configuration & Validation
   Zero hardcoded secrets. All secrets read securely from process.env.
   ====================================================== */

export const YOXA_WORKFLOW_KEYS = [
  "intake",
  "preauth",
  "materialChange",
  "discharge",
  "settlement",
  "appeal",
] as const;

export type WorkflowKey = (typeof YOXA_WORKFLOW_KEYS)[number];

const yoxaWorkflows = {
  intake: {
    key: "intake",
    name: "coverage-twin-intake-context",
    triggerUrl: process.env.YOXA_INTAKE_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/b2d95949-60e3-46b5-840c-281e6c7d8036/trigger",
    secret: process.env.YOXA_INTAKE_SECRET || "",
  },
  preauth: {
    key: "preauth",
    name: "workflow_planned_cashless_preauthorisation",
    triggerUrl: process.env.YOXA_PREAUTH_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/fafe1c40-a62d-43a5-9c5a-f1e0a786506c/trigger",
    secret: process.env.YOXA_PREAUTH_SECRET || "",
  },
  materialChange: {
    key: "materialChange",
    name: "material-change-re-evaluation",
    triggerUrl: process.env.YOXA_MATERIAL_CHANGE_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/135f8a9c-c80f-46e7-a62f-bf5df01ce8ec/trigger",
    secret: process.env.YOXA_MATERIAL_CHANGE_SECRET || "",
  },
  discharge: {
    key: "discharge",
    name: "coverage-twin-discharge-evidence-collection",
    triggerUrl: process.env.YOXA_DISCHARGE_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/97365bfb-9a5d-4ac3-81be-4c0612b363e0/trigger",
    secret: process.env.YOXA_DISCHARGE_SECRET || "",
  },
  settlement: {
    key: "settlement",
    name: "coverage-twin-final-bill-reconciliation-settlement",
    triggerUrl: process.env.YOXA_SETTLEMENT_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/e728f6f6-c2b4-4de0-81f5-6da7cf54355b/trigger",
    secret: process.env.YOXA_SETTLEMENT_SECRET || "",
  },
  appeal: {
    key: "appeal",
    name: "coverage-twin-appeal-dispute-resolution",
    triggerUrl: process.env.YOXA_APPEAL_TRIGGER_URL || "https://yoxa.ai/api/v1/public/workflow-deployments/571cea3c-3126-4bfc-a75f-b6f4a557c8c8/trigger",
    secret: process.env.YOXA_APPEAL_SECRET || "",
  },
} as const;

export const env = {
  appUrl: process.env.APP_URL || "http://localhost:3000",

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uzvqxpfdxwckhtvvjkzo.supabase.co",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  yoxa: {
    ...yoxaWorkflows,
    webhookSecret: process.env.YOXA_WEBHOOK_SECRET || "",
  },
} as const;
