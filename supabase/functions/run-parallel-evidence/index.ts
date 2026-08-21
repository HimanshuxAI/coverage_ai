// deno-lint-ignore-file no-explicit-any
import { createClient, generateAuditEventId, generateAgentRunId } from '../_shared/supabase.ts';
import { DEMO_POLICY_EVIDENCE, DEMO_CLINICAL_EVIDENCE, DEMO_COST_EVIDENCE } from '../_shared/demo-data.ts';
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

    const { data: caseRecord, error: readError } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', case_id)
      .single();

    if (readError || !caseRecord) {
      return jsonResponse(
        { success: false, error: 'Case not found', error_code: 'CASE_NOT_FOUND' },
        404
      );
    }

    if (caseRecord.current_case_status !== 'ACTIVATED_VALIDATED') {
      return jsonResponse(
        {
          success: false,
          error: `Case must be ACTIVATED_VALIDATED, current: ${caseRecord.current_case_status}`,
          error_code: 'INVALID_STATE',
        },
        400
      );
    }

    const caseVersion = caseRecord.case_version;

    // Use simulated data
    const policyEvidence = { ...DEMO_POLICY_EVIDENCE, case_id, case_version: caseVersion, agent_name: 'policy' };
    const clinicalEvidence = { ...DEMO_CLINICAL_EVIDENCE, case_id, case_version: caseVersion, agent_name: 'clinical' };
    const costEvidence = { ...DEMO_COST_EVIDENCE, case_id, case_version: caseVersion, agent_name: 'cost_contract' };

    const [policyResult, clinicalResult, costResult] = await Promise.all([
      supabase.from('evidence_reports').upsert(
        { ...policyEvidence, completed_at: new Date().toISOString() },
        { onConflict: 'case_id,case_version,agent_name' }
      ).select().single(),
      supabase.from('evidence_reports').upsert(
        { ...clinicalEvidence, completed_at: new Date().toISOString() },
        { onConflict: 'case_id,case_version,agent_name' }
      ).select().single(),
      supabase.from('evidence_reports').upsert(
        { ...costEvidence, completed_at: new Date().toISOString() },
        { onConflict: 'case_id,case_version,agent_name' }
      ).select().single(),
    ]);

    const anyError = policyResult.error || clinicalResult.error || costResult.error;

    if (anyError) {
      await supabase
        .from('cases')
        .update({ current_case_status: 'TOOL_FAILURE', updated_at: new Date().toISOString() })
        .eq('case_id', case_id);

      return jsonResponse(
        {
          success: false,
          error: 'One or more evidence agents failed',
          error_code: 'TOOL_FAILURE',
          details: {
            policy: policyResult.error?.message,
            clinical: clinicalResult.error?.message,
            cost: costResult.error?.message,
          },
        },
        500
      );
    }

    await supabase
      .from('cases')
      .update({
        current_case_status: 'EVIDENCE_RESOLVED',
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', case_id);

    await supabase.from('audit_events').insert({
      audit_event_id: generateAuditEventId(case_id, 'EVIDENCE'),
      case_id,
      case_version: caseVersion,
      event_type: 'EVIDENCE_RESOLUTION',
      event_data: {
        policy_status: policyEvidence.report_status,
        clinical_status: clinicalEvidence.report_status,
        cost_status: costEvidence.report_status,
        all_agents_succeeded: true,
      },
      agent_run_id: agentRunId,
    });

    return jsonResponse({
      success: true,
      data: {
        case_id,
        case_version: caseVersion,
        evidence_count: 3,
        policy_evidence_result: { report_status: policyEvidence.report_status, tool_status: 'SUCCESS' },
        clinical_evidence_result: { report_status: clinicalEvidence.report_status, tool_status: 'SUCCESS' },
        cost_contract_result: { report_status: costEvidence.report_status, tool_status: 'SUCCESS' },
        new_case_status: 'EVIDENCE_RESOLVED',
      },
    });
  } catch (err: any) {
    return jsonResponse(
      { success: false, error: String(err), error_code: 'TOOL_FAILURE' },
      500
    );
  }
});
