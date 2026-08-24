/* ======================================================
   YOXA — Server-Side HTTP Client
   Handles triggers, authentication headers, timeouts, and bounded retries.
   ====================================================== */

import { getWorkflowDefinition } from "./registry";
import type { YoxaWorkflowKey, YoxaTriggerResponse } from "./types";

interface TriggerOptions {
  workflowKey: YoxaWorkflowKey;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  maxRetries?: number;
  timeoutMs?: number;
}

export async function triggerYoxaWorkflow(options: TriggerOptions): Promise<YoxaTriggerResponse> {
  const { workflowKey, idempotencyKey, payload, maxRetries = 2, timeoutMs = 15000 } = options;
  const def = getWorkflowDefinition(workflowKey);

  const requestBody = JSON.stringify(payload || { trigger_text: "Start workflow" });

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[YoxaClient] Triggering workflow=${workflowKey} attempt=${attempt} idempotencyKey=${idempotencyKey}`);

      const res = await fetch(def.triggerUrl, {
        method: "POST",
        headers: {
          "X-Yoxa-Deployment-Secret": def.secret,
          "Idempotency-Key": idempotencyKey,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const rawText = await res.text();
      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = { raw: rawText };
      }

      if (res.ok) {
        console.log(`[YoxaClient] Workflow=${workflowKey} triggered successfully (status=${res.status})`);
        return {
          success: true,
          statusCode: res.status,
          data: parsedData,
          rawBody: rawText,
        };
      }

      const isRetryable = res.status >= 500 || Boolean((parsedData.error as Record<string, unknown>)?.retryable);
      console.warn(`[YoxaClient] Workflow=${workflowKey} trigger failed (status=${res.status}, retryable=${isRetryable})`);

      if (isRetryable && attempt <= maxRetries) {
        const backoffMs = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return {
        success: false,
        statusCode: res.status,
        data: parsedData,
        error: (parsedData.error as YoxaTriggerResponse["error"]) || {
          code: `HTTP_${res.status}`,
          message: rawText,
          retryable: isRetryable,
        },
        rawBody: rawText,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const error = err as Error;
      lastError = error;
      console.error(`[YoxaClient] Network/Timeout error on workflow=${workflowKey} attempt=${attempt}:`, error.message);

      if (attempt <= maxRetries) {
        const backoffMs = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  return {
    success: false,
    statusCode: 0,
    error: {
      code: "CLIENT_ERROR",
      message: lastError?.message || "Trigger failed after retries",
      retryable: true,
    },
  };
}
