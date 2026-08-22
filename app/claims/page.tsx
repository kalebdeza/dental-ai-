"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, Brain, ArrowRight } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { getClaims } from "@/lib/data/claims";

type Claim = Tables<"claims">;

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    try {
      const data = await getClaims();
      console.log("Claims:", data);
      setClaims(data);
    } catch (error) {
      console.error("Error loading claims:", error);
    }
  }

  const filtered = claims.filter((claim) => {
    const text = `${claim.claim_number ?? ""} ${claim.insurance_company ?? ""} ${claim.status}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  function statusColor(status: string) {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "denied":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Revenue Recovery
          </p>

          <h1 className="text-4xl font-bold">
            Insurance Claims
          </h1>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Sync Claims
          </button>

          <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800">
            <Brain className="h-4 w-4" />
            Run AI Review
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />

        <input
          className="w-full rounded-xl border bg-white py-3 pl-12 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search claims..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filtered.map((claim) => (
          <div
            key={claim.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {claim.claim_number ?? "No Claim Number"}
                </h2>

                <p className="mt-1 text-slate-500">
                  {claim.insurance_company ?? "Unknown Insurance"}
                </p>

                <p className="mt-3">
                  Status: {claim.status}
                </p>
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold text-green-600">
                  ${claim.amount_billed.toLocaleString()}
                </div>

                <p className="text-sm text-slate-500">
                  Remaining: ${claim.remaining_balance.toLocaleString()}
                </p>

                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor(
                    claim.status
                  )}`}
                >
                  {claim.status}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <div>
                <p className="font-semibold">
                  🤖 AI Recommendation
                </p>

                <p className="text-sm text-slate-500">
                  AI analysis will appear here after Open Dental sync.
                </p>
              </div>

              <Link
                href={`/claims/${claim.id}`}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
              >
                Open
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}

        {!filtered.length && (
          <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
            No claims found.
          </div>
        )}
      </div>
    </main>
  );
}