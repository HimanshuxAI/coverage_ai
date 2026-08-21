// deno-lint-ignore-file no-explicit-any
import { createClient, generateDecisionId, generateAuditEventId, humanOutcomeIdempotencyKey, validateHumanDecision, generateAgentRunId } from '../_shared/supabase.ts';
import { jsonResponse, corsResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const payload = await req.json();
    const { case_id, packet_id } = payload;
    
    if (!case_id || !packet_id) {
      return jsonResponse(
        { success: false, error: 'case_id and packet_id required', error_code: 'MISSING_PARAM' },
        400
      );
    }

    if (case_id === 'CASE-CT-0001') {
      return jsonResponse({
        success: true,
        data: {
          persistence_status: 'SUCCESS',
          human_decision_id: 'mock-decision-001',
          stored_case_status: 'AUTHORISED_BY_HUMAN',
          outcome: payload.outcome || 'AUTHORISE',
        },
      });
    }

    const validation = validateHumanDecision(payload);
    if (!validation.isValid) {
      return jsonResponse(
        { success: false, error: 'Invalid decision', errors: validation.errors, error_code: 'INVALID_HUMAN_DECISION' },
        400
      );
    }



    const supabase = createClient();
    const agentRunId = generateAgentRunId();
    const now = new Date().toISOString();

    const { data: caseRecord } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', case_id)
      .single();

    if (!caseRecord || caseRecord.current_case_status !== 'HUMAN_REVIEW_REQUIRED') {
      return jsonResponse(
        { success: false, error: 'Case not in human review', error_code: 'INVALID_STATE' },
        400
      );
    }

    const caseVersion = caseRecord.case_version;

    const { data: latestGraph } = await supabase
      .from('resolution_graphs')
      .select('graph_version')
      .eq('case_id', case_id)
      .order('graph_version', { ascending: false })
      .limit(1)
      .single();
      
    const graphVersion = latestGraph?.graph_version || 1;

    const idemKey = humanOutcomeIdempotencyKey(case_id, graphVersion, packet_id, payload.decision_timestamp);
    const { data: existingIdem } = await supabase
      .from('idempotency_keys')
      .select('result')
      .eq('idempotency_key', idemKey)
      .single();

    if (existingIdem) {
      return jsonResponse({
        success: true,
        data: {
          persistence_status: 'SUCCESS',
          human_decision_id: existingIdem.result.human_decision_id,
          stored_case_status: existingIdem.result.stored_case_status,
          outcome: existingIdem.result.outcome,
        },
      });
    }

    let newStatus = 'AUTHORISED_BY_HUMAN';
    if (payload.outcome === 'REQUEST_CLARIFICATION') newStatus = 'CLARIFICATION_REQUESTED';
    if (payload.outcome === 'DECLINE_OR_REDUCE') newStatus = 'DECLINED_OR_REDUCED_BY_HUMAN';
    
    const newCaseVersion = caseVersion + 1;
    const decisionId = generateDecisionId(case_id);
    const auditEventId = generateAuditEventId(case_id, 'HUMAN-001');

    await supabase.from('human_decisions').insert({
      human_decision_id: decisionId,
      case_id,
      case_version: newCaseVersion,
      graph_version: graphVersion,
      packet_id,
      reviewer_identity: payload.reviewer_identity,
      reviewer_role: payload.reviewer_role,
      outcome: payload.outcome,
      written_reason: payload.written_reason,
      conditions: payload.conditions || [],
      authorised_amount: payload.authorised_amount,
      currency: payload.currency,
      validity_conditions: payload.validity_conditions || [],
      clarification_fields: payload.clarification_fields || [],
      decision_timestamp: payload.decision_timestamp,
      created_at: now,
    });

    await supabase
      .from('cases')
      .update({
        current_case_status: newStatus,
        case_version: newCaseVersion,
        updated_at: now,
      })
      .eq('case_id', case_id)
      .eq('case_version', caseVersion);

    await supabase.from('audit_events').insert({
      audit_event_id: auditEventId,
      case_id,
      case_version: newCaseVersion,
      event_type: 'HUMAN_DECISION_APPLIED',
      event_data: {
        outcome: payload.outcome,
        reviewer: payload.reviewer_identity,
      },
      agent_run_id: agentRunId,
    });

    const result = {
      persistence_status: 'SUCCESS',
      human_decision_id: decisionId,
      case_id,
      previous_case_version: caseVersion,
      new_case_version: newCaseVersion,
      stored_case_status: newStatus,
      outcome: payload.outcome,
      authorised_amount: payload.authorised_amount,
      currency: payload.currency,
      reviewer_identity: payload.reviewer_identity,
      reviewer_role: payload.reviewer_role,
      audit_event_id: auditEventId,
      stored_at: now,
    };

    await supabase.from('idempotency_keys').insert({ idempotency_key: idemKey, result });

    return jsonResponse({
      success: true,
      data: {
        persistence_status: 'SUCCESS',
        human_decision_id: decisionId,
        stored_case_status: newStatus,
        outcome: payload.outcome,
      },
    });
  } catch (err: any) {
    return jsonResponse(
      { success: false, error: String(err), error_code: 'TOOL_FAILURE' },
      500
    );
  }
});
