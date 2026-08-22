import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";

import { taskGenerator } from "@/services/taskGenerator";

export async function GET() {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { practice } = auth;

    const tasks =
      await taskGenerator.generateTasks(
        practice.id
      );

    return ApiResponse.ok(tasks);
  } catch (error) {
    logger.error(
      "Tasks request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}