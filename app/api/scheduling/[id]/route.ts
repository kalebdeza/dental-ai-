import { NextRequest } from "next/server";

import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { requirePractice } from "@/lib/auth/requirePractice";
import { loadSchedulingDetail } from "@/lib/data/scheduling";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { id } = await context.params;
    const item = await loadSchedulingDetail(auth.supabase, auth.practice.id, id);

    if (!item) {
      return ApiResponse.notFound("Appointment not found.");
    }

    return ApiResponse.ok({ item });
  } catch (error) {
    logger.error("Scheduling detail failed", error);
    return ApiErrorHandler.handle(error);
  }
}
