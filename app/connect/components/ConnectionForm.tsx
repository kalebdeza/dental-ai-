"use client";

import { useState } from "react";
import { PMSProvider } from "./PMSSelector";

interface ConnectionFormProps {
  provider: PMSProvider;
  onConnected: () => void;
}

export default function ConnectionForm({
  provider,
  onConnected,
}: ConnectionFormProps) {
  const [customerKey, setCustomerKey] = useState("");
  const [loading, setLoading] = useState(false);

  if (provider !== "opendental") {
    return (
      <div className="mt-8 rounded-2xl border bg-slate-50 p-6">
        <h2 className="text-xl font-semibold capitalize">
          {provider.replace("-", " ")}
        </h2>

        <p className="mt-2 text-slate-500">
          This integration is currently in development.
          Join the waitlist to be notified when it's available.
        </p>

        <button className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">
          Join Waitlist
        </button>
      </div>
    );
  }

  async function handleTestConnection() {
    if (!customerKey.trim()) {
      alert("Please enter your Customer API Key.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/opendental/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerKey,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Connection failed.");
        return;
      }

      onConnected();
    } catch (error) {
      console.error(error);
      alert("Unable to connect to Open Dental.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">
        Connect Open Dental
      </h2>

      <p className="mt-2 text-slate-500">
        Enter your Customer API Key to connect your Open Dental practice.
      </p>

      <div className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Customer API Key
          </label>

          <input
            type="password"
            value={customerKey}
            onChange={(e) => setCustomerKey(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="Paste your Customer API Key"
          />
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Testing Connection..." : "Test Connection"}
        </button>
      </div>
    </div>
  );
}