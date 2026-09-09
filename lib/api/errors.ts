import { ZodError } from "zod";
import { logger } from "./logger.ts";
import { ApiResponse } from "./response.ts";
import { safeErrorMeta } from "./safeLog.ts";

export class ApiErrorHandler {
  static handle(error: unknown) {
    if (error instanceof ZodError) {
      return ApiResponse.badRequest(
        error.issues[0]?.message ?? "Validation failed."
      );
    }

    logger.error("Unhandled API error", safeErrorMeta(error));

    return ApiResponse.internal();
  }
}
