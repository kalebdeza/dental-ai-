import { NextRequest } from "next/server";

import { treatmentScanner } from "@/services/treatmentScanner";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

import type { SupabaseServerClient } from "@/lib/auth/types";

async function runScan(
  supabase: SupabaseServerClient,
  practiceId: string
) {
  const opportunities = await treatmentScanner.scan(
    supabase,
    practiceId
  );

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

    const opportunities = await runScan(
      auth.supabase,
      auth.practice.id
    );

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