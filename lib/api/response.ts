import { NextResponse } from "next/server";

export class ApiResponse {
  static ok(data: unknown) {
    return NextResponse.json(data, {
      status: 200,
    });
  }

  static created(data: unknown) {
    return NextResponse.json(data, {
      status: 201,
    });
  }

  static badRequest(message: string) {
    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      }
    );
  }

  static unauthorized() {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  static forbidden() {
    return NextResponse.json(
      {
        success: false,
        message: "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }

  static notFound(message = "Not found.") {
    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 404,
      }
    );
  }

  static tooManyRequests(
    message = "Too many requests."
  ) {
    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 429,
      }
    );
  }

  static internal() {
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      {
        status: 500,
      }
    );
  }
}