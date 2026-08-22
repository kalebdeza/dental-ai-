import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function checkRateLimit(
  req: NextRequest,
  limit = 10,
  window: "1 m" | "1 h" | "1 d" = "1 m"
) {
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      limit,
      window
    ),
    analytics: true,
  });

  return ratelimit.limit(ip);
}