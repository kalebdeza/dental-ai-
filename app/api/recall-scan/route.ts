import { NextRequest } from "next/server";

import { recallScanner } from "@/services/recallScanner";

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

    const { practice } = auth;

    const opportunities = await recallScanner.scan(
      practice.id
    );

    const { error: deleteError } = await supabase
      .from("revenue_opportunities")
      .delete()
      .eq("practice_id", practice.id)
      .eq("opportunity_type", "Recall");

    if (deleteError) {
      logger.error(
        "Failed to delete previous recall opportunities",
        deleteError
      );

      return ApiResponse.internal();
    }

    if (opportunities.length > 0) {
      const { error: insertError } = await supabase
        .from("revenue_opportunities")
        .insert(opportunities);

      if (insertError) {
        logger.error(
          "Failed to insert recall opportunities",
          insertError
        );

        return ApiResponse.internal();
      }
    }

    return ApiResponse.ok({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    logger.error("Recall scan failed", error);

    return ApiErrorHandler.handle(error);
  }
}