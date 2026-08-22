import { NextRequest } from "next/server";
import { generateClaimNarrative } from "@/lib/openai";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

export async function POST(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req, 10, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many AI requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const body = await req.json();

    const narrative = await generateClaimNarrative(
      body.patientName,
      body.procedureName,
      body.procedureCode,
      Number(body.insuranceEstimate)
    );

    return ApiResponse.ok({
      success: true,
      narrative,
    });
  } catch (error) {
    logger.error("Claim narrative generation failed", error);

    return ApiErrorHandler.handle(error);
  }
}