import { randomUUID } from "crypto";

import { Redis } from "@upstash/redis";

import { PRACTICE_JOB_LOCK_TTL_SECONDS } from "./timeout.ts";

const PRACTICE_JOB_CURSOR_KEY = "practice-jobs:integration-cursor";

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Upstash Redis is not configured.");
  }

  return new Redis({
    url,
    token,
    automaticDeserialization: false,
  });
}

function lockKey(practiceId: string): string {
  return `practice-job:${practiceId}`;
}

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export async function acquirePracticeJobLock(
  practiceId: string
): Promise<string | null> {
  const redis = getRedis();
  const token = randomUUID();
  const acquired = await redis.set(lockKey(practiceId), token, {
    nx: true,
    ex: PRACTICE_JOB_LOCK_TTL_SECONDS,
  });

  if (acquired !== "OK") {
    return null;
  }

  return token;
}

export async function releasePracticeJobLock(
  practiceId: string,
  token: string
): Promise<void> {
  const redis = getRedis();
  const script = redis.createScript<number>(RELEASE_LOCK_SCRIPT);
  await script.eval([lockKey(practiceId)], [token]);
}

/**
 * Last integration id inspected by a previous cron tick.
 * Stored in Redis, never taken from the HTTP request.
 */
export async function loadPracticeJobCursor(): Promise<string | null> {
  const redis = getRedis();
  const value = await redis.get<string>(PRACTICE_JOB_CURSOR_KEY);

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
}

export async function savePracticeJobCursor(
  integrationId: string
): Promise<void> {
  const redis = getRedis();
  await redis.set(PRACTICE_JOB_CURSOR_KEY, integrationId);
}
