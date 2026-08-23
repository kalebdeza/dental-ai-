import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

import { revenueOpportunityScanner } from "@/services/revenueOpportunityScanner";

export async function GET(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(
      req,
      5,
      "1 m"
    );

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many revenue scan requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const result =
      await revenueOpportunityScanner.scan(
        auth.supabase,
        auth.practice.id
      );

    logger.info(
      "Revenue opportunity scan completed",
      {
        practiceId: auth.practice.id,
        created: result.created,
        claims: result.claims,
        recalls: result.recalls,
        treatments: result.treatments,
      }
    );

    return ApiResponse.ok({
      success: true,
      message:
        "Revenue opportunity scan completed.",
      ...result,
    });
  } catch (error) {
    logger.error(
      "Revenue scan failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}