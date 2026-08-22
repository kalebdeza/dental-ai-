import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { validate } from "@/lib/api/validate";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { auditLog } from "@/lib/api/audit";

import { requirePractice } from "@/lib/auth/requirePractice";
import { testConnectionSchema } from "@/lib/validation/opendental";

import { openDental } from "@/services/opendental";
import { integrationService } from "@/services/integrationService";

export async function POST(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req);

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { practice } = auth;

    const { customerKey } = await validate(
      req,
      testConnectionSchema
    );

    const result = await openDental.testConnection(customerKey);

    if (!result.success) {
      await auditLog({
        userId: auth.user.id,
        practiceId: practice.id,
        action: "opendental_connection_failed",
        resource: "integration",
      });

      logger.warn("Open Dental connection failed", {
        practiceId: practice.id,
        reason: result.message,
      });

      return ApiResponse.badRequest(result.message);
    }

    await integrationService.saveOpenDentalCredentials(
      practice.id,
      customerKey
    );

    await auditLog({
      userId: auth.user.id,
      practiceId: practice.id,
      action: "opendental_connected",
      resource: "integration",
    });

    logger.info("Open Dental connected", {
      practiceId: practice.id,
    });

    return ApiResponse.ok({
      success: true,
      clinic: result.clinic,
      message: "Open Dental connected successfully.",
    });
  } catch (error) {
    return ApiErrorHandler.handle(error);
  }
}