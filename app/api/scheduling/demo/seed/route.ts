import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { requirePractice } from "@/lib/auth/requirePractice";
import { createAuthenticatedSchedulingContext } from "@/lib/scheduling/context";
import { seedDemoSchedule } from "@/lib/scheduling/demoSeed";
import { processDueSchedulingJobs } from "@/lib/scheduling/jobs";

export async function POST() {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const ctx = createAuthenticatedSchedulingContext({
      client: auth.supabase,
      practiceId: auth.practice.id,
      actor: "demo",
    });

    const seeded = await seedDemoSchedule(ctx.store, auth.practice.id);
    const jobs = await processDueSchedulingJobs(ctx, {
      practiceId: auth.practice.id,
    });

    return ApiResponse.ok({
      ...seeded,
      jobs,
    });
  } catch (error) {
    logger.error("Demo schedule seed failed", error);
    return ApiErrorHandler.handle(error);
  }
}
