"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function CreatePracticePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [practiceName, setPracticeName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  async function createPractice(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("Logged in user:", user);

    if (!user) {
      alert("Please login.");
      setLoading(false);
      return;
    }

    const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("*")
  .eq("owner_user_id", user.id)
  .single();

console.log("Organization:", organization);
console.log("Organization Error:", JSON.stringify(organizationError, null, 2));

    if (organizationError || !organization) {
      alert("Organization not found.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("practices")
      .insert({
        organization_id: organization.id,
        name: practiceName,
        phone,
        email,
        address,
        city,
        state,
        zip_code: zipCode,
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/connect");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={createPractice}
        className="w-full max-w-2xl rounded-2xl bg-white p-10 shadow-xl"
      >
        <h1 className="text-3xl font-bold">
          Create Practice
        </h1>

        <p className="mt-2 text-slate-500">
          Tell us about your dental practice.
        </p>

        <div className="mt-8 grid gap-4">

          <input
            className="rounded-xl border p-3"
            placeholder="Practice Name"
            value={practiceName}
            onChange={(e)=>setPracticeName(e.target.value)}
            required
          />

          <input
            className="rounded-xl border p-3"
            placeholder="Phone Number"
            value={phone}
            onChange={(e)=>setPhone(e.target.value)}
          />

          <input
            className="rounded-xl border p-3"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />

          <input
            className="rounded-xl border p-3"
            placeholder="Address"
            value={address}
            onChange={(e)=>setAddress(e.target.value)}
          />

          <input
            className="rounded-xl border p-3"
            placeholder="City"
            value={city}
            onChange={(e)=>setCity(e.target.value)}
          />

          <input
            className="rounded-xl border p-3"
            placeholder="State"
            value={state}
            onChange={(e)=>setState(e.target.value)}
          />

          <input
            className="rounded-xl border p-3"
            placeholder="ZIP Code"
            value={zipCode}
            onChange={(e)=>setZipCode(e.target.value)}
          />

        </div>

        <button
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
        >
          {loading ? "Creating Practice..." : "Continue"}
        </button>
      </form>
    </main>
  );
}