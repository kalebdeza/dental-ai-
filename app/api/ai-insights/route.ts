import { NextRequest } from "next/server";
import {
  generateAIInsights,
  DashboardAIData,
} from "@/lib/openai";

import { ApiResponse } from "@/lib/api/response";
import { aiGuard } from "@/lib/api/aiGuard";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

export async function POST(request: NextRequest) {
  try {
    const disabled = aiGuard();

    if (disabled) {
      return disabled;
    }

    const { success } = await checkRateLimit(
      request,
      10,
      "1 m"
    );

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many AI insight requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const data: DashboardAIData = await request.json();

    const insight = await generateAIInsights(data);

    return ApiResponse.ok({
      success: true,
      insight,
    });
  } catch (error) {
    logger.error("AI Insights Error", error);

    return ApiErrorHandler.handle(error);
  }
}