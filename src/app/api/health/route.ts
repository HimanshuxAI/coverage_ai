/* ======================================================
   COVERAGE TWIN — Health & Integration Status API
   GET /api/health
   ====================================================== */

import { NextResponse } from "next/server";
import {
  DASHBOARD_WORKFLOW_KEYS,
  type HealthStatus,
} from "@/lib/dashboard/metrics";
import { env } from "@/config/env";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const databaseConfigured = Boolean(env.supabase.url && env.supabase.publishableKey);
  let databaseReachable = false;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cases").select("case_id").limit(1);
    databaseReachable = !error;
  } catch {
    databaseReachable = false;
  }

  const workflows = Object.fromEntries(
    DASHBOARD_WORKFLOW_KEYS.map((workflowKey) => [
      workflowKey,
      {
        configured: Boolean(
          env.yoxa[workflowKey].triggerUrl && env.yoxa[workflowKey].secret
        ),
      },
    ])
  ) as HealthStatus["workflows"];

  const payload: HealthStatus = {
    status: databaseReachable ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    database: {
      configured: databaseConfigured,
      reachable: databaseReachable,
    },
    workflows,
  };

  return NextResponse.json(payload);
}
