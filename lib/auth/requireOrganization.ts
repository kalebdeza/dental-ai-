import { NextResponse } from "next/server";
import { requireUser } from "./requireUser";
import { RequireOrganizationResult } from "./types";

export async function requireOrganization(): Promise<RequireOrganizationResult> {
  const auth = await requireUser();

  if (!auth.success) {
    return auth;
  }

  const { supabase, user } = auth;

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_user_id", user.id)
    .single();

  if (error || !organization) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Organization not found.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    supabase,
    user,
    organization,
  };
}