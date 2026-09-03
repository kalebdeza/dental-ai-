import { createHash, timingSafeEqual } from "crypto";

import type { NextRequest } from "next/server";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Accepts only Authorization: Bearer $CRON_SECRET.
 * Cookies, query strings, and practice headers are ignored.
 */
export function authorizeCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return false;
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = header.slice("Bearer ".length);

  return timingSafeEqual(digest(provided), digest(expected));
}
