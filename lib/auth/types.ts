import { NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/database.types";

export type SupabaseServerClient = Awaited<
  ReturnType<typeof createClient>
>;

export type Organization =
  Database["public"]["Tables"]["organizations"]["Row"];

export type Practice =
  Database["public"]["Tables"]["practices"]["Row"];

export interface AuthFailure {
  success: false;
  response: NextResponse;
}

export interface UserSuccess {
  success: true;
  supabase: SupabaseServerClient;
  user: User;
}

export interface OrganizationSuccess extends UserSuccess {
  organization: Organization;
}

export interface PracticeSuccess extends OrganizationSuccess {
  practice: Practice;
}

export type RequireUserResult =
  | UserSuccess
  | AuthFailure;

export type RequireOrganizationResult =
  | OrganizationSuccess
  | AuthFailure;

export type RequirePracticeResult =
  | PracticeSuccess
  | AuthFailure;