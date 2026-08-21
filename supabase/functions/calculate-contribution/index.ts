// deno-lint-ignore-file no-explicit-any
import { jsonResponse, corsResponse } from '../_shared/cors.ts';

// Deterministic Contribution Calculator
function calculateExpectedContribution(input: any): any {
  const now = new Date().toISOString();

  if (
    input.contracted_package_rate === undefined ||
    input.co_payment_rate === undefined ||
    input.deductible_amount === undefined
  ) {
    return {
      case_id: input.case_id,
      case_version: input.case_version,
      currency: input.currency,
      eligible_estimate_total: 0,
      non_payable_total: 0,
      contracted_package_rate: 0,
      applicable_sub_limit: null,
      contract_eligible_amount: 0,
      capped_amount: 0,
      co_payment_rate: 0,
      co_payment_amount: 0,
      deductible_amount: 0,
      amount_above_contract_ceiling: 0,
      expected_insurer_contribution: 0,
      expected_patient_contribution: 0,
      calculation_version: 'CALC-1.0',
      calculated_at: now,
      status: 'CALCULATION_INPUT_MISSING',
      assumptions: [],
      formulas: {},
    };
  }

  const eligible_estimate_total = input.eligible_line_items.reduce((sum: number, item: number) => sum + item, 0);
  const non_payable_total = input.non_payable_items.reduce((sum: number, item: number) => sum + item, 0);

  const contract_eligible_amount = Math.min(eligible_estimate_total, input.contracted_package_rate);

  const capped_amount = (input.applicable_sub_limit !== undefined && input.applicable_sub_limit !== null)
    ? Math.min(contract_eligible_amount, input.applicable_sub_limit)
    : contract_eligible_amount;

  const co_payment_amount = Math.round(capped_amount * input.co_payment_rate * 100) / 100;

  const expected_insurer_contribution = Math.max(
    0,
    capped_amount - co_payment_amount - input.deductible_amount
  );

  const amount_above_contract_ceiling = Math.max(
    0,
    eligible_estimate_total - input.contracted_package_rate
  );

  const expected_patient_contribution =
    non_payable_total +
    co_payment_amount +
    input.deductible_amount +
    amount_above_contract_ceiling;

  return {
    case_id: input.case_id,
    case_version: input.case_version,
    currency: input.currency,
    eligible_estimate_total,
    non_payable_total,
    contracted_package_rate: input.contracted_package_rate,
    applicable_sub_limit: input.applicable_sub_limit,
    contract_eligible_amount,
    capped_amount,
    co_payment_rate: input.co_payment_rate,
    co_payment_amount,
    deductible_amount: input.deductible_amount,
    amount_above_contract_ceiling,
    expected_insurer_contribution,
    expected_patient_contribution,
    calculation_version: 'CALC-1.0',
    calculated_at: now,
    status: 'CALCULATION_COMPLETE',
    assumptions: [
      'All values are provisional',
      'No human-authorised exception to the contract ceiling',
    ],
    formulas: {
      eligible_estimate_total: 'sum(eligible_line_items)',
      non_payable_total: 'sum(non_payable_items)',
      contract_eligible_amount: 'min(eligible_estimate_total, contracted_package_rate)',
      capped_amount: 'min(contract_eligible_amount, applicable_sub_limit)',
      co_payment_amount: 'capped_amount × co_payment_rate',
      expected_insurer_contribution: 'max(0, capped_amount - co_payment_amount - deductible_amount)',
      expected_patient_contribution: 'non_payable_total + co_payment_amount + deductible_amount + amount_above_contract_ceiling',
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const payload = await req.json();
    
    if (!payload.case_id) {
      return jsonResponse(
        { success: false, error: 'case_id is required', error_code: 'MISSING_PARAM' },
        400
      );
    }

    const result = calculateExpectedContribution(payload);

    if (result.status === 'CALCULATION_INPUT_MISSING' || result.status === 'CALCULATION_INPUT_CONFLICT') {
      return jsonResponse(
        {
          success: false,
          error: 'Calculation input fields missing or conflicting',
          error_code: result.status
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      data: {
        case_id: result.case_id,
        currency: result.currency,
        expected_insurer_contribution: result.expected_insurer_contribution,
        expected_patient_contribution: result.expected_patient_contribution,
        status: result.status,
      },
    });
  } catch (err: any) {
    return jsonResponse(
      { success: false, error: String(err), error_code: 'TOOL_FAILURE' },
      500
    );
  }
});
