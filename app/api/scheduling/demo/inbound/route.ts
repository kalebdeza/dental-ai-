import { NextRequest } from "next/server";
import { z } from "zod";

import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { requirePractice } from "@/lib/auth/requirePractice";
import { loadSchedulingDetail } from "@/lib/data/scheduling";
import { createAuthenticatedSchedulingContext } from "@/lib/scheduling/context";
import { handleInboundSms } from "@/lib/scheduling/workflow";

const Body = z.object({
  body: z.string().trim().min(1).max(480),
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const input = Body.parse(await request.json());
    const ctx = createAuthenticatedSchedulingContext({
      client: auth.supabase,
      practiceId: auth.practice.id,
      actor: "patient",
    });

    const result = await handleInboundSms(ctx, {
      practiceId: auth.practice.id,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      body: input.body,
    });

    const item = result.appointmentId
      ? await loadSchedulingDetail(
          auth.supabase,
          auth.practice.id,
          result.appointmentId
        )
      : null;

    return ApiResponse.ok({ result, item });
  } catch (error) {
    logger.error("Demo inbound SMS failed", error);
    return ApiErrorHandler.handle(error);
  }
}
