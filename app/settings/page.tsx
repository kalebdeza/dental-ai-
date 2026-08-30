import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";

import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const auth = await requireUser();

  if (!auth.success) {
    redirect("/login");
  }

  const { data: practiceIds } =
    await auth.supabase.rpc("user_practice_ids");

  const accessibleIds = practiceIds ?? [];

  const { data: practices } =
    accessibleIds.length === 0
      ? { data: [] }
      : await auth.supabase
          .from("practices")
          .select("id, name")
          .in("id", accessibleIds)
          .order("name");

  return (
    <SettingsClient
      email={auth.user.email ?? ""}
      practices={practices ?? []}
    />
  );
}
