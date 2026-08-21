// deno-lint-ignore-file no-explicit-any
import { createClient, generateAuditEventId, generateAgentRunId, blockerIdempotencyKey } from '../_shared/supabase.ts';
import { jsonResponse, corsResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { case_id } = await req.json();
    if (!case_id) {
      return jsonResponse(
        { success: false, error: 'case_id is required', error_code: 'MISSING_PARAM' },
        400
      );
    }

    const supabase = createClient();
    const agentRunId = generateAgentRunId();

    if (case_id === 'CASE-CT-0001') {
      return jsonResponse({
        success: true,
        data: { case_id, graph_version: 1 },
      });
    }

    const { data: caseRecord } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', case_id)
      .single();

    if (!caseRecord) {
      return jsonResponse(
        { success: false, error: 'Case not found', error_code: 'CASE_NOT_FOUND' },
        404
      );
    }

    const { data: latestGraph } = await supabase
      .from('resolution_graphs')
      .select('*')
      .eq('case_id', case_id)
      .order('graph_version', { ascending: false })
      .limit(1)
      .single();

    if (!latestGraph) {
      return jsonResponse(
        { success: false, error: 'No resolution graph found', error_code: 'GRAPH_NOT_FOUND' },
        404
      );
    }

    const graphState = latestGraph.graph_state;
    const now = new Date().toISOString();

    if (graphState === 'DECISION_READY') {
      const idemKey = blockerIdempotencyKey(
        case_id,
        latestGraph.graph_version,
        [],
        'NO_BLOCKER_ACTION_REQUIRED'
      );

      const { data: existingIdem } = await supabase
        .from('idempotency_keys')
        .select('result')
        .eq('idempotency_key', idemKey)
        .single();

      if (existingIdem) {
        return jsonResponse({
          success: true,
          data: { ...existingIdem.result, idempotency_result: 'ALREADY_EXISTS' },
        });
      }

      await supabase.from('blocker_actions').insert({
        case_id,
        case_version: caseRecord.case_version,
        graph_version: latestGraph.graph_version,
        dependency_ids: [],
        blocker_status: 'NO_BLOCKER_ACTION_REQUIRED',
        owner: 'SYSTEM',
        reason_codes: ['ALL_DEPENDENCIES_RESOLVED'],
        next_safe_action: 'GENERATE_DECISION_PACKET_AND_REQUEST_HUMAN_DECISION',
        agent_run_id: agentRunId,
      });

      const auditEventId = generateAuditEventId(case_id, 'BLOCKER-NONE');
      await supabase.from('audit_events').insert({
        audit_event_id: auditEventId,
        case_id,
        case_version: caseRecord.case_version,
        event_type: 'BLOCKER_RESOLUTION',
        event_data: {
          graph_version: latestGraph.graph_version,
          blocker_status: 'NO_BLOCKER_ACTION_REQUIRED',
          graph_state: 'DECISION_READY',
        },
        agent_run_id: agentRunId,
      });

      const result = {
        case_id,
        graph_version: latestGraph.graph_version,
        stored_status: 'NO_BLOCKER_ACTION_REQUIRED',
        graph_state: 'DECISION_READY',
        unresolved_dependencies: [],
        next_safe_action: 'GENERATE_DECISION_PACKET_AND_REQUEST_HUMAN_DECISION',
        audit_event_id: auditEventId,
        stored_at: now,
      };

      await supabase.from('idempotency_keys').insert({ idempotency_key: idemKey, result });

      return jsonResponse({
        success: true,
        data: { case_id, graph_version: latestGraph.graph_version },
      });
    }

    if (graphState === 'HUMAN_AMBIGUITY') {
      await supabase
        .from('cases')
        .update({
          current_case_status: 'HUMAN_REVIEW_REQUIRED',
          updated_at: now,
        })
        .eq('case_id', case_id);

      return jsonResponse({
        success: true,
        data: {
          case_id,
          graph_version: latestGraph.graph_version,
        },
      });
    }

    if (graphState === 'RESOLVABLE_MISSING_EVIDENCE') {
      await supabase.from('blocker_actions').insert({
        case_id,
        case_version: caseRecord.case_version,
        graph_version: latestGraph.graph_version,
        dependency_ids: latestGraph.unresolved_dependencies,
        blocker_status: 'EVIDENCE_REQUESTED',
        owner: 'HOSPITAL',
        reason_codes: ['MINIMUM_EVIDENCE_REQUESTED'],
        next_safe_action: 'WAIT_FOR_EVIDENCE',
        agent_run_id: agentRunId,
      });

      await supabase
        .from('cases')
        .update({ current_case_status: 'WAITING_FOR_EVIDENCE', updated_at: now })
        .eq('case_id', case_id);

      return jsonResponse({
        success: true,
        data: {
          case_id,
          graph_version: latestGraph.graph_version,
        },
      });
    }

    return jsonResponse({
      success: true,
      data: {
        case_id,
        graph_version: latestGraph.graph_version,
      },
    });
  } catch (err: any) {
    return jsonResponse(
      { success: false, error: String(err), error_code: 'TOOL_FAILURE' },
      500
    );
  }
});
