import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uzvqxpfdxwckhtvvjkzo.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_32Pp8FvBlqp5s2_03HJiXg_1Z0nEYrn';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const caseId = 'CASE-CT-REAL-001';

  const newCase = {
    case_id: caseId,
    case_version: 1,
    patient_consent_status: false,
    hospital_clinical_confirmation_status: false,
    member_id: 'MEM-998877',
    policy_id: 'POL-123456',
    hospital_id: 'HOSP-MUM-01',
    diagnosis: 'K80.1 - Calculus of gallbladder with other cholecystitis',
    planned_procedure: '47562 - Laparoscopic cholecystectomy',
    planned_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    evidence_references: [],
    document_provenance: 'UNVERIFIED',
    current_case_status: 'WAITING_FOR_ACTIVATION',
    source_system: 'coverage_twin_case_registry',
  };

  console.log(`Inserting case ${caseId}...`);

  const { data, error } = await supabase
    .from('cases')
    .upsert(newCase, { onConflict: 'case_id' })
    .select()
    .single();

  if (error) {
    console.error('Error inserting case:', error);
    process.exit(1);
  }

  console.log('Successfully inserted case:');
  console.log(data);

  // Insert initial audit event
  const auditEvent = {
    audit_event_id: `evt_${Date.now()}`,
    case_id: caseId,
    case_version: 1,
    event_type: 'CASE_CREATED',
    event_data: { note: 'Initial hardcoded seed via script' },
    agent_run_id: 'system',
    timestamp: new Date().toISOString(),
  };

  const { error: auditError } = await supabase
    .from('audit_events')
    .insert(auditEvent);

  if (auditError) {
    console.error('Error inserting audit event:', auditError);
  } else {
    console.log('Successfully inserted audit event.');
  }
}

main();
