import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";

import DashboardClient from "./DashboardClient";

export default async function HomePage() {
  const auth = await requireUser();

  if (!auth.success) {
    redirect("/login");
  }

  const { data: practiceIds, error: practiceIdsError } =
    await auth.supabase.rpc("user_practice_ids");

  if (practiceIdsError) {
    redirect("/login");
  }

  if (!practiceIds || practiceIds.length === 0) {
    redirect("/onboarding");
  }

  return <DashboardClient />;
}
