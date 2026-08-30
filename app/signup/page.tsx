"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (data.session) {
      router.refresh();
      router.push("/onboarding");
      return;
    }

    alert(
      "Account created. Check your email to confirm, then sign in."
    );
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <h1 className="text-3xl font-bold">
          Dental Revenue AI
        </h1>

        <p className="mt-2 text-slate-500">
          Create your account
        </p>

        <div className="mt-8 space-y-4">

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            className="w-full rounded-xl border p-3"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded-xl border p-3"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

        </div>

        <button
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

      </form>
    </main>
  );
}