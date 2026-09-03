/**
 * One source of truth for cron invocation length and lock lifetime.
 *
 * PRACTICE_JOB_MAX_DURATION_SECONDS is the intended Next.js/Vercel route
 * maxDuration. The route file must export that same number as a literal
 * (`export const maxDuration = 300`) because Next.js cannot statically
 * analyze an imported constant.
 *
 * PRACTICE_JOB_LOCK_TTL_SECONDS must be strictly greater so the lock cannot
 * expire while this invocation is still allowed to run.
 */
export const PRACTICE_JOB_MAX_DURATION_SECONDS = 300;

export const PRACTICE_JOB_LOCK_TTL_SECONDS =
  PRACTICE_JOB_MAX_DURATION_SECONDS + 60;
