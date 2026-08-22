"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, Brain, ArrowRight } from "lucide-react";
import { getPatients } from "../../lib/data/patients";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

async function loadPatients() {
  try {
    setPatients(await getPatients());
  } catch (error) {
    console.error(error);
  }
}

  const filtered = patients.filter((patient) => {
    const name =
      `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.toLowerCase();

    return name.includes(search.toLowerCase());
  });

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Patient Management
          </p>

          <h1 className="text-4xl font-bold">Patients</h1>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Sync Patients
          </button>

          <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800">
            <Brain className="h-4 w-4" />
            Run AI Scan
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />

        <input
          className="w-full rounded-xl border bg-white py-3 pl-12 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filtered.map((patient) => (
          <div
            key={patient.id}
            className="flex items-center justify-between rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div>
              <h2 className="text-xl font-semibold">
                {patient.first_name} {patient.last_name}
              </h2>

              <p className="text-slate-500">
                Patient #{patient.patient_number}
              </p>
            </div>

            <Link
              href={`/patients/${patient.id}`}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
            >
              Open
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}

        {!filtered.length && (
          <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
            No patients found.
          </div>
        )}
      </div>
    </main>
  );
}