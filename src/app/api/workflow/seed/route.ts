/* ======================================================
   YOXA — API: Seed Demo Case
   POST /api/workflow/seed
   ====================================================== */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { DEMO_CASE } from "@/lib/workflow/seed-data";

export async function POST() {
  try {
    const supabase = await createClient();

    // Check if demo case already exists
    const { data: existing } = await supabase
      .from("cases")
      .select("case_id")
      .eq("case_id", DEMO_CASE.case_id)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { message: "Demo case already exists", case_id: DEMO_CASE.case_id },
      });
    }

    const { data, error } = await supabase
      .from("cases")
      .insert(DEMO_CASE)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, error_code: "SEED_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Demo case seeded", case_id: data.case_id },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), error_code: "SEED_ERROR" },
      { status: 500 }
    );
  }
}
