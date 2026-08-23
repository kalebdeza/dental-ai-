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

export type PracticeMember =
  Database["public"]["Tables"]["practice_members"]["Row"];

import type { PracticeRole } from "./roles";

export {
  PRACTICE_ROLES,
  isPracticeRole,
} from "./roles";

export type { PracticeRole } from "./roles";

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
  organizations: Organization[];
}

// No longer extends OrganizationSuccess: membership attaches to the
// practice, so the organization is derived from the selected practice
// rather than gating access to it.
export interface PracticeSuccess extends UserSuccess {
  organization: Organization;
  practice: Practice;
  practices: Practice[];
  role: PracticeRole;
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
