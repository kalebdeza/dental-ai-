"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function OnboardingPage() {
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);

  async function createOrganization(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("organizations")
      .insert({
  name: organizationName,
  owner_user_id: user.id,
})
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    localStorage.setItem("organizationId", data.id);

    router.push("/onboarding/practice");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={createOrganization}
        className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-xl"
      >
        <h1 className="text-3xl font-bold">
          Welcome to Dental Revenue AI
        </h1>

        <p className="mt-2 text-slate-500">
          Let's create your organization.
        </p>

        <div className="mt-8">
          <label className="mb-2 block text-sm font-medium">
            Organization Name
          </label>

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Example Dental Group"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        </div>

        <button
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-blue-600 p-3 font-semibold text-white"
        >
          {loading ? "Creating..." : "Continue"}
        </button>
      </form>
    </main>
  );
}