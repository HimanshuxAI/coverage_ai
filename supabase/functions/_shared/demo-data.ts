// Hardcoded demo evidence data baked into the codebase.
// These match the YOXA workflow representative outputs exactly.

export const DEMO_POLICY_EVIDENCE = {
  report_status: 'SUPPORTED',
  findings: {
    policy_active: true,
    member_eligible: true,
    procedure_covered: true,
    original_policy_inception: '2023-04-01',
    planned_admission_date: '2026-08-24',
    waiting_period_months: 24,
    waiting_period_satisfied: true,
    continuous_coverage_confirmed: true,
    applicable_exclusion_found: false,
    applicable_pre_existing_disease_restriction_found: false,
    network_hospital_confirmed: true,
    hospital_id: 'HSP-NIR-021',
    room_eligibility: 'Single private room up to INR 5,000 per day',
    procedure_sub_limit: 120000,
    co_payment_rate: 0.1,
    deductible_amount: 5000,
  },
  citations: [
    'ASP-2026.1 Policy Schedule, page 1',
    'ASP-2026.1 Clause 2.1, page 1',
    'ASP-2026.1 Clause 2.4, page 1',
    'ASP-2026.1 Clause 3.2, page 1',
    'ASP-2026.1 Clause 4.1, page 1',
    'ASP-2026.1 Clause 5.3, page 1',
    'ASP-2026.1 Clause 6.1',
    'ASP-2026.1 Clause 8.4, page 2',
  ],
  unresolved_dependencies: [],
  tool_status: 'SUCCESS',
};

export const DEMO_CLINICAL_EVIDENCE = {
  report_status: 'SUPPORTED',
  findings: {
    diagnosis: 'Symptomatic cholelithiasis',
    planned_procedure: 'Laparoscopic cholecystectomy',
    clinical_record_version: 'CLIN-3',
    doctor_recommendation_confirmed: true,
    diagnostic_support_confirmed: true,
    medical_necessity_supported: true,
    planned_pre_authorisation_ready: true,
    post_authorisation_conditions: ['CLINICAL-FITNESS-001'],
  },
  citations: ['Clinical Record CLIN-3'],
  unresolved_dependencies: [],
  tool_status: 'SUCCESS',
};

export const DEMO_COST_EVIDENCE = {
  report_status: 'SUPPORTED_PROVISIONALLY',
  findings: {
    hospital_id: 'HSP-NIR-021',
    network_status: 'CONFIRMED',
    contract_reference: 'NIR-ASP-2026',
    contract_version: 'CONTRACT-2026.2',
    estimate_reference: 'EST-2026-8841',
    estimate_version: 'EST-2',
    calculation_version: 'CALC-1.0',
    eligible_estimate_total: 105000,
    contracted_package_rate: 100000,
    non_payable_total: 7000,
    expected_insurer_contribution: 85000,
    expected_patient_contribution: 27000,
    currency: 'INR',
  },
  citations: [
    'Contract NIR-ASP-2026 v CONTRACT-2026.2',
    'Estimate EST-2026-8841 v EST-2',
  ],
  unresolved_dependencies: [],
  tool_status: 'SUCCESS',
};

export const POLICY_CITATIONS = [
  'ASP-2026.1 Policy Schedule, page 1',
  'Clause 2.1 — In-patient hospitalisation, page 1',
  'Clause 2.4 — Planned cashless pre-authorisation, page 1',
  'Clause 3.2 — Laparoscopic cholecystectomy, page 1',
  'Clause 4.1 — Waiting period, page 1',
  'Clause 5.3 — Room eligibility, page 1',
  'Clause 6.1 — Co-payment and deductible',
  'Clause 8.4 — Human authority, page 2',
];
