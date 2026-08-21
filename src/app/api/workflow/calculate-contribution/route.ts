import { NextRequest, NextResponse } from "next/server";
import { calculateExpectedContribution, CalculationInput } from "@/lib/workflow/calculations";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CalculationInput;
    
    if (!payload.case_id) {
      return NextResponse.json(
        { success: false, error: "case_id is required", error_code: "MISSING_PARAM" },
        { status: 400 }
      );
    }

    const result = calculateExpectedContribution(payload);

    if (result.status === "CALCULATION_INPUT_MISSING" || result.status === "CALCULATION_INPUT_CONFLICT") {
      return NextResponse.json(
        { success: false, data: result },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "TOOL_FAILURE" },
      { status: 500 }
    );
  }
}
