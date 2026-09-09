import { NextRequest } from "next/server";

import { recallScanner } from "@/services/recallScanner";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";
import { mergeOpportunitiesByType } from "@/lib/cron/mergeOpportunitiesByType";

export async function GET(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req, 5, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many recall scan requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;

    const opportunities = await recallScanner.scan(supabase, practice.id);

    const result = await mergeOpportunitiesByType(
      { supabase, practiceId: practice.id },
      "Recall",
      opportunities
    );

    return ApiResponse.ok({
      success: true,
      count: result.created,
      ...result,
    });
  } catch (error) {
    logger.error("Recall scan failed", error);

    return ApiErrorHandler.handle(error);
  }
}
