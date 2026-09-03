import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type SchedulerSupabaseClient = SupabaseClient<Database>;

/**
 * Cookie-free Supabase client for future server-side practice jobs.
 *
 * Uses the service role key and never the anon key or a user session.
 * Import only from server modules. Client Components must not import this
 * file (`server-only` fails the build if they do).
 */
export function createSchedulerClient(): SchedulerSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
