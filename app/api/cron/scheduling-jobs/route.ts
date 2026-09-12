import { NextRequest } from "next/server";

import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { authorizeCronRequest } from "@/lib/cron/authorizeCron";
import { createCronSchedulingContext } from "@/lib/scheduling/context";
import { processDueSchedulingJobs } from "@/lib/scheduling/jobs";
import { createSchedulerClient } from "@/lib/supabase/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processes due scheduling / demo SMS jobs.
 * Does not contact Open Dental.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCronRequest(request)) {
    return ApiResponse.unauthorized();
  }

  try {
    const supabase = createSchedulerClient();
    const ctx = createCronSchedulingContext({ client: supabase });
    const summary = await processDueSchedulingJobs(ctx);

    logger.info("Scheduling jobs processed", summary);
    return ApiResponse.ok({
      success: true,
      contactedOpenDental: false,
      sentRealSms: false,
      ...summary,
    });
  } catch (error) {
    logger.error("Scheduling job cron failed", error);
    return ApiErrorHandler.handle(error);
  }
}
