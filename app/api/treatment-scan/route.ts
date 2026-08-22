import { NextRequest } from "next/server";

import { treatmentScanner } from "@/services/treatmentScanner";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/api/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function runScan(practiceId: string) {
  const opportunities = await treatmentScanner.scan(practiceId);

  const { error: deleteError } = await supabase
    .from("revenue_opportunities")
    .delete()
    .eq("practice_id", practiceId)
    .eq("opportunity_type", "Treatment");

  if (deleteError) {
    throw deleteError;
  }

  if (opportunities.length > 0) {
    const { error } = await supabase
      .from("revenue_opportunities")
      .insert(opportunities);

    if (error) {
      throw error;
    }
  }

  return opportunities;
}

export async function GET(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req, 5, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many treatment scan requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const opportunities = await runScan(auth.practice.id);

    return ApiResponse.ok({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    logger.error("Treatment scan failed", error);

    return ApiErrorHandler.handle(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}