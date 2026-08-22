import { NextResponse } from "next/server";
import { requireOrganization } from "./requireOrganization";
import { RequirePracticeResult } from "./types";

export async function requirePractice(): Promise<RequirePracticeResult> {
  const auth = await requireOrganization();

  if (!auth.success) {
    return auth;
  }

  const { supabase, user, organization } = auth;

  const { data: practice, error } = await supabase
    .from("practices")
    .select("*")
    .eq("organization_id", organization.id)
    .single();

  if (error || !practice) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Practice not found.",
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
    practice,
  };
}