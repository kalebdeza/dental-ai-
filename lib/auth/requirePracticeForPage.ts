import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

import { requireUser } from "./requireUser";
import {
  PRACTICE_ID_HEADER,
  resolveCurrentPractice,
} from "./resolvePractice";
import { Practice, SupabaseServerClient } from "./types";

export interface PagePracticeContext {
  supabase: SupabaseServerClient;
  user: User;
  practice: Practice;
  practices: Practice[];
}

/*
 * The page equivalent of requirePractice.
 *
 * requirePractice answers with a NextResponse, which a server component cannot
 * return, so this shares the security primitives instead of the shape: the same
 * user_practice_ids() lookup and the same pure resolver, with every failure
 * turned into a redirect.
 *
 * Ambiguity is never resolved by picking a practice. A user with several
 * practices and no explicit selection is sent to the dashboard, because
 * choosing for them would mean rendering one tenant's records on the strength
 * of a URL alone.
 */
export async function requirePracticeForPage(): Promise<PagePracticeContext> {
  const auth = await requireUser();

  if (!auth.success) {
    redirect("/login");
  }

  const { supabase, user } = auth;

  // The header is the only selection mechanism the application has. A plain
  // navigation will not carry it, which is precisely why the ambiguous case
  // below redirects rather than guessing.
  const requestedPracticeId = (await headers()).get(
    PRACTICE_ID_HEADER
  );

  const { data: practiceIds, error: practiceIdsError } =
    await supabase.rpc("user_practice_ids");

  if (practiceIdsError) {
    redirect("/login");
  }

  const accessibleIds = practiceIds ?? [];

  if (accessibleIds.length === 0) {
    redirect("/onboarding");
  }

  const { data: practices, error: practicesError } =
    await supabase
      .from("practices")
      .select("*")
      .in("id", accessibleIds)
      .order("name");

  if (practicesError) {
    redirect("/login");
  }

  const accessiblePractices: Practice[] = practices ?? [];

  const resolution = resolveCurrentPractice(
    accessiblePractices,
    requestedPracticeId
  );

  if (resolution.kind === "noAccess") {
    redirect("/onboarding");
  }

  // A selection outside the caller's own practices, and the ambiguous case,
  // both land on the dashboard. Neither may fall through to a practice.
  if (
    resolution.kind === "notFound" ||
    resolution.kind === "ambiguous"
  ) {
    redirect("/");
  }

  return {
    supabase,
    user,
    practice: resolution.practice,
    practices: accessiblePractices,
  };
}
