import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { requireUser } from "./requireUser";
import {
  PRACTICE_ID_HEADER,
  resolveCurrentPractice,
} from "./resolvePractice";
import {
  AuthFailure,
  Practice,
  RequirePracticeResult,
  isPracticeRole,
} from "./types";

export interface RequirePracticeOptions {
  practiceId?: string | null;
}

function failure(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): AuthFailure {
  return {
    success: false,
    response: NextResponse.json(
      {
        success: false,
        message,
        ...extra,
      },
      { status }
    ),
  };
}

/**
 * Resolves the practice a request applies to, from the session only.
 *
 * Access comes from user_practice_ids(), which covers both organization
 * owners and practice members. An explicit selection may arrive through
 * the X-Practice-Id header, but it is honoured only if it is already in
 * the caller's accessible set, so a client can choose among its own
 * practices and nothing else.
 */
export async function requirePractice(
  options?: RequirePracticeOptions
): Promise<RequirePracticeResult> {
  const auth = await requireUser();

  if (!auth.success) {
    return auth;
  }

  const { supabase, user } = auth;

  const requestedPracticeId =
    options?.practiceId ??
    (await headers()).get(PRACTICE_ID_HEADER);

  const { data: practiceIds, error: practiceIdsError } =
    await supabase.rpc("user_practice_ids");

  if (practiceIdsError) {
    return failure(403, "Practice not found.");
  }

  const accessibleIds = practiceIds ?? [];

  if (accessibleIds.length === 0) {
    return failure(403, "Practice not found.");
  }

  const { data: practices, error: practicesError } =
    await supabase
      .from("practices")
      .select("*")
      .in("id", accessibleIds)
      .order("name");

  if (practicesError) {
    return failure(403, "Practice not found.");
  }

  const accessiblePractices: Practice[] = practices ?? [];

  const resolution = resolveCurrentPractice(
    accessiblePractices,
    requestedPracticeId
  );

  if (resolution.kind === "noAccess") {
    return failure(403, "Practice not found.");
  }

  if (resolution.kind === "notFound") {
    return failure(404, "Practice not found.");
  }

  if (resolution.kind === "ambiguous") {
    return failure(
      400,
      `Several practices are available. Choose one with the ${PRACTICE_ID_HEADER} header.`,
      {
        practices: resolution.practices.map((practice) => ({
          id: practice.id,
          name: practice.name,
        })),
      }
    );
  }

  const practice = resolution.practice;

  const { data: organization, error: organizationError } =
    await supabase
      .from("organizations")
      .select("*")
      .eq("id", practice.organization_id)
      .maybeSingle();

  if (organizationError || !organization) {
    return failure(403, "Organization not found.");
  }

  const { data: role, error: roleError } = await supabase.rpc(
    "user_practice_role",
    { p_practice_id: practice.id }
  );

  if (roleError || !isPracticeRole(role)) {
    return failure(403, "Practice not found.");
  }

  return {
    success: true,
    supabase,
    user,
    organization,
    practice,
    practices: accessiblePractices,
    role,
  };
}
