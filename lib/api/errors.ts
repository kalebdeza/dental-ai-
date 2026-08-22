import { ZodError } from "zod";
import { ApiResponse } from "./response";

export class ApiErrorHandler {
  static handle(error: unknown) {
    if (error instanceof ZodError) {
      return ApiResponse.badRequest(
        error.issues[0]?.message ?? "Validation failed."
      );
    }

    if (error instanceof Error) {
      console.error(error);

      return ApiResponse.internal();
    }

    console.error(error);

    return ApiResponse.internal();
  }
}