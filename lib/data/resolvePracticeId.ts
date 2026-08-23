import { supabase } from "@/lib/supabase";

/**
 * The one practice this browser session may query without an explicit
 * selection. Zero or several IDs are reported as null so callers fail
 * closed instead of guessing or running an unscoped query.
 */
export async function resolveSolePracticeId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("user_practice_ids");

  if (error) {
    return null;
  }

  const ids = data ?? [];

  if (ids.length !== 1) {
    return null;
  }

  return ids[0];
}
