import { NextRequest } from "next/server";
import { z } from "zod";

import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { requirePractice } from "@/lib/auth/requirePractice";
import { loadSchedulingDetail } from "@/lib/data/scheduling";
import { createAuthenticatedSchedulingContext } from "@/lib/scheduling/context";
import {
  cancelAppointmentWorkflow,
  confirmAppointment,
  requestReschedule,
} from "@/lib/scheduling/workflow";

const Body = z.object({
  action: z.enum(["confirm", "reschedule", "cancel"]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { id } = await context.params;
    const body = Body.parse(await request.json());
    const ctx = createAuthenticatedSchedulingContext({
      client: auth.supabase,
      practiceId: auth.practice.id,
      actor: "office",
    });

    if (body.action === "confirm") {
      await confirmAppointment(ctx, auth.practice.id, id);
    } else if (body.action === "reschedule") {
      await requestReschedule(ctx, auth.practice.id, id);
    } else {
      await cancelAppointmentWorkflow(ctx, auth.practice.id, id, "office");
    }

    const item = await loadSchedulingDetail(auth.supabase, auth.practice.id, id);
    return ApiResponse.ok({ item });
  } catch (error) {
    logger.error("Scheduling action failed", error);
    return ApiErrorHandler.handle(error);
  }
}
