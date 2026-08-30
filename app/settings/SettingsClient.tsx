"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type PracticeSummary = {
  id: string;
  name: string;
};

export default function SettingsClient({
  email,
  practices,
}: {
  email: string;
  practices: PracticeSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
    router.push("/login");
  }

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-4xl font-bold">Settings</h1>

      <section className="rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Account</h2>
        <p className="mt-2 text-slate-500">
          Signed in with this account.
        </p>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-sm font-medium text-slate-500">Email</dt>
            <dd className="mt-1 text-lg font-semibold">
              {email || "No email on this account"}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-slate-500">
              Practices
            </dt>
            <dd className="mt-1">
              {practices.length === 0 ? (
                <span className="text-slate-500">
                  No practice yet. Finish onboarding to create one.
                </span>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {practices.map((practice) => (
                    <li key={practice.id} className="font-semibold">
                      {practice.name}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Session</h2>
        <p className="mt-2 text-slate-500">
          Sign out of this browser. Other users and practices are not
          changed.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </section>
    </main>
  );
}
