/* ======================================================
   YOXA — Deterministic Contribution Calculator
   Implements the exact arithmetic from the Cost & Contract spec
   ====================================================== */

export interface CalculationInput {
  case_id: string;
  case_version: number;
  currency: string;
  eligible_line_items: number[];
  non_payable_items: number[];
  contracted_package_rate: number;
  room_category_adjustment: number;
  co_payment_rate: number;
  deductible_amount: number;
  applicable_sub_limit: number | null;
}

export interface CalculationResult {
  case_id: string;
  case_version: number;
  currency: string;
  eligible_estimate_total: number;
  non_payable_total: number;
  contracted_package_rate: number;
  applicable_sub_limit: number | null;
  contract_eligible_amount: number;
  capped_amount: number;
  co_payment_rate: number;
  co_payment_amount: number;
  deductible_amount: number;
  amount_above_contract_ceiling: number;
  expected_insurer_contribution: number;
  expected_patient_contribution: number;
  calculation_version: string;
  calculated_at: string;
  status: "CALCULATION_COMPLETE" | "CALCULATION_INPUT_MISSING" | "CALCULATION_INPUT_CONFLICT";
  assumptions: string[];
  formulas: Record<string, string>;
}

export function calculateExpectedContribution(input: CalculationInput): CalculationResult {
  const now = new Date().toISOString();

  // Validate required numeric inputs
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
      calculation_version: "CALC-1.0",
      calculated_at: now,
      status: "CALCULATION_INPUT_MISSING",
      assumptions: [],
      formulas: {},
    };
  }

  // Step 1: Sum eligible line items
  const eligible_estimate_total = input.eligible_line_items.reduce((sum, item) => sum + item, 0);

  // Step 2: Sum non-payable items
  const non_payable_total = input.non_payable_items.reduce((sum, item) => sum + item, 0);

  // Step 3: contract_eligible_amount = min(eligible_estimate_total, contracted_package_rate)
  const contract_eligible_amount = Math.min(eligible_estimate_total, input.contracted_package_rate);

  // Step 4: capped_amount = min(contract_eligible_amount, applicable_sub_limit) when sub-limit exists
  const capped_amount = input.applicable_sub_limit !== null
    ? Math.min(contract_eligible_amount, input.applicable_sub_limit)
    : contract_eligible_amount;

  // Step 5: co_payment_amount = capped_amount × co_payment_rate
  const co_payment_amount = Math.round(capped_amount * input.co_payment_rate * 100) / 100;

  // Step 6: expected_insurer_contribution = max(0, capped_amount - co_payment_amount - deductible_amount)
  const expected_insurer_contribution = Math.max(
    0,
    capped_amount - co_payment_amount - input.deductible_amount
  );

  // Step 7: amount_above_contract_ceiling
  const amount_above_contract_ceiling = Math.max(
    0,
    eligible_estimate_total - input.contracted_package_rate
  );

  // Step 8: expected_patient_contribution
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
    calculation_version: "CALC-1.0",
    calculated_at: now,
    status: "CALCULATION_COMPLETE",
    assumptions: [
      "All values are provisional",
      "No human-authorised exception to the contract ceiling",
    ],
    formulas: {
      eligible_estimate_total: "sum(eligible_line_items)",
      non_payable_total: "sum(non_payable_items)",
      contract_eligible_amount: "min(eligible_estimate_total, contracted_package_rate)",
      capped_amount: "min(contract_eligible_amount, applicable_sub_limit)",
      co_payment_amount: "capped_amount × co_payment_rate",
      expected_insurer_contribution: "max(0, capped_amount - co_payment_amount - deductible_amount)",
      expected_patient_contribution: "non_payable_total + co_payment_amount + deductible_amount + amount_above_contract_ceiling",
    },
  };
}
