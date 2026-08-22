import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";

import { openDentalSync } from "@/services/opendentalSync";

export async function POST(req: NextRequest) {
  try {
    const { success } =
      await checkRateLimit(
        req,
        3,
        "1 m"
      );

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many sync requests. Please try again in a minute."
      );
    }

    const auth =
      await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const result =
      await openDentalSync.sync(
        auth.practice.id
      );

    logger.info(
      "Open Dental sync completed",
      {
        practiceId:
          auth.practice.id,

        patients:
          result.patients,

        procedureCodes:
          result.procedureCodes,

        procedures:
          result.procedures,

        claims:
          result.claims,

        recalls:
          result.recalls,
      }
    );

    return ApiResponse.ok({
      success: true,

      message:
        "Open Dental patient, procedure code, procedure, claim, and recall sync completed.",

      ...result,
    });
  } catch (error) {
    logger.error(
      "Open Dental sync failed",
      error
    );

    return ApiErrorHandler.handle(
      error
    );
  }
}