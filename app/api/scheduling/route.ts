import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { requirePractice } from "@/lib/auth/requirePractice";
import { loadSchedulingBoard } from "@/lib/data/scheduling";

export async function GET() {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const items = await loadSchedulingBoard(auth.supabase, auth.practice.id);
    return ApiResponse.ok({
      practice: {
        id: auth.practice.id,
        name: auth.practice.name,
        timezone: auth.practice.timezone,
      },
      appointments: items,
    });
  } catch (error) {
    logger.error("Scheduling list failed", error);
    return ApiErrorHandler.handle(error);
  }
}
