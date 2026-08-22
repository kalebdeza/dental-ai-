import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { env } from "@/lib/api/env";
import { requirePractice } from "@/lib/auth/requirePractice";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req, 2, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many demo data requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { error: revenueDeleteError } = await supabase
      .from("revenue_opportunities")
      .delete()
      .not("id", "is", null);

    if (revenueDeleteError) {
      throw revenueDeleteError;
    }

    const { error: claimDeleteError } = await supabase
      .from("claims")
      .delete()
      .not("id", "is", null);

    if (claimDeleteError) {
      throw claimDeleteError;
    }

    const { error: procedureDeleteError } = await supabase
      .from("procedures")
      .delete()
      .not("id", "is", null);

    if (procedureDeleteError) {
      throw procedureDeleteError;
    }

    const { error: patientDeleteError } = await supabase
      .from("patients")
      .delete()
      .not("id", "is", null);

    if (patientDeleteError) {
      throw patientDeleteError;
    }

    const { data: patients, error: patientError } = await supabase
      .from("patients")
      .insert([
        {
          patient_number: "1001",
          first_name: "John",
          last_name: "Smith",
          email: "john@example.com",
          phone: "555-1234",
        },
      ])
      .select();

    if (patientError) {
      throw patientError;
    }

    const patient = patients![0];

    const { data: procedures, error: procedureError } = await supabase
      .from("procedures")
      .insert([
        {
          patient_id: patient.id,
          procedure_code: "D2740",
          procedure_name: "Crown",
          fee: 1280,
          status: "Completed",
        },
      ])
      .select();

    if (procedureError) {
      throw procedureError;
    }

    const procedure = procedures![0];

    const { error: claimError } = await supabase
      .from("claims")
      .insert([
        {
          patient_id: patient.id,
          procedure_id: procedure.id,
          claim_number: "CLM-1001",
          status: "Not Submitted",
          insurance_paid: 0,
          insurance_estimate: 1280,
        },
      ]);

    if (claimError) {
      throw claimError;
    }

    return ApiResponse.ok({
      success: true,
      message: "Demo data reset successfully!",
    });
  } catch (error) {
    logger.error("Demo data reset failed", error);

    return ApiErrorHandler.handle(error);
  }
}