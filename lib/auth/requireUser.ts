import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RequireUserResult } from "./types";

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    supabase,
    user,
  };
}