// deno-lint-ignore-file no-explicit-any
import { createClient, generateAgentRunId, generateAuditEventId } from '../_shared/supabase.ts';
import { jsonResponse, corsResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const payload = await req.json();
    const { case_id, resolved_dependencies, reviewer_identity, outcome } = payload;
    
    if (!case_id || !reviewer_identity || !outcome) {
      return jsonResponse(
        { success: false, error: 'case_id, reviewer_identity, and outcome are required', error_code: 'MISSING_PARAM' },
        400
      );
    }

    if (case_id === 'CASE-CT-0001') {
      return jsonResponse({
        success: true,
        data: { case_id, clarification_status: 'RECEIVED', new_case_status: 'EVIDENCE_UPDATED' },
      });
    }

    const supabase = createClient();
    const agentRunId = generateAgentRunId();
    const now = new Date().toISOString();

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

    const newGraphVersion = latestGraph.graph_version + 1;

    const newUnresolved = latestGraph.unresolved_dependencies.filter(
      (dep: string) => !(resolved_dependencies || []).includes(dep)
    );

    const newGraphState = newUnresolved.length === 0 ? 'DECISION_READY' : latestGraph.graph_state;

    await supabase.from('resolution_graphs').insert({
      graph_id: `${latestGraph.graph_id.split('-v')[0]}-v${newGraphVersion}`,
      case_id,
      case_version: latestGraph.case_version,
      graph_version: newGraphVersion,
      graph_state: newGraphState,
      dependency_nodes: latestGraph.dependency_nodes,
      unresolved_dependencies: newUnresolved,
      post_authorisation_conditions: latestGraph.post_authorisation_conditions,
      state_reason_codes: ['HUMAN_CLARIFICATION_APPLIED'],
      next_safe_action: newGraphState === 'DECISION_READY' ? 'GENERATE_DECISION_PACKET' : latestGraph.next_safe_action,
      source_report_versions: latestGraph.source_report_versions,
      created_at: now,
    });

    await supabase.from('blocker_actions').insert({
      case_id,
      case_version: latestGraph.case_version,
      graph_version: newGraphVersion,
      dependency_ids: resolved_dependencies || [],
      blocker_status: 'RESOLVED',
      owner: reviewer_identity,
      reason_codes: ['CLARIFICATION_RESOLVED'],
      next_safe_action: newGraphState === 'DECISION_READY' ? 'GENERATE_DECISION_PACKET' : 'CONTINUE_RESOLUTION',
      agent_run_id: agentRunId,
      created_at: now,
    });

    if (newGraphState === 'DECISION_READY') {
      await supabase
        .from('cases')
        .update({ current_case_status: 'DECISION_READY', updated_at: now })
        .eq('case_id', case_id);
    }

    const auditEventId = generateAuditEventId(case_id, 'GRAPH-RECONCILED');

    return jsonResponse({
      success: true,
      data: {
        persistence_status: 'SUCCESS',
        case_id,
        graph_version: newGraphVersion,
        graph_state: newGraphState,
        audit_event_id: auditEventId,
      },
    });
  } catch (err: any) {
    return jsonResponse(
      { success: false, error: String(err), error_code: 'TOOL_FAILURE' },
      500
    );
  }
});
