import { NextResponse } from "next/server";

import { requireUser } from "./requireUser";
import {
  AuthFailure,
  Organization,
  RequireOrganizationResult,
} from "./types";

function failure(
  status: number,
  message: string
): AuthFailure {
  return {
    success: false,
    response: NextResponse.json(
      {
        success: false,
        message,
      },
      { status }
    ),
  };
}

/**
 * Resolves the organization a request applies to.
 *
 * Membership-aware: user_organization_ids() covers organizations the user
 * owns as well as those reached through a practice membership, so staff
 * are no longer rejected for owning nothing. Practice access no longer
 * flows through this helper; requirePractice derives the organization from
 * the selected practice instead.
 */
export async function requireOrganization(): Promise<RequireOrganizationResult> {
  const auth = await requireUser();

  if (!auth.success) {
    return auth;
  }

  const { supabase, user } = auth;

  const { data: organizationIds, error: organizationIdsError } =
    await supabase.rpc("user_organization_ids");

  if (organizationIdsError) {
    return failure(403, "Organization not found.");
  }

  const accessibleIds = organizationIds ?? [];

  if (accessibleIds.length === 0) {
    return failure(403, "Organization not found.");
  }

  const { data: organizations, error: organizationsError } =
    await supabase
      .from("organizations")
      .select("*")
      .in("id", accessibleIds)
      .order("name");

  if (organizationsError) {
    return failure(403, "Organization not found.");
  }

  const accessibleOrganizations: Organization[] =
    organizations ?? [];

  if (accessibleOrganizations.length === 0) {
    return failure(403, "Organization not found.");
  }

  // Reported rather than guessed. Callers that need to disambiguate should
  // resolve a practice first, which carries its organization with it.
  if (accessibleOrganizations.length > 1) {
    return failure(
      400,
      "Several organizations are available. Resolve a practice instead."
    );
  }

  return {
    success: true,
    supabase,
    user,
    organization: accessibleOrganizations[0],
    organizations: accessibleOrganizations,
  };
}
