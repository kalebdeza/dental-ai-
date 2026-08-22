import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";

interface PatientHeroProps {
  patient: any;
}

export default function PatientHero({
  patient,
}: PatientHeroProps) {
  return (
    <div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <User className="h-10 w-10 text-blue-600" />
          </div>

          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              {patient.first_name} {patient.last_name}
            </h1>

            <p className="mt-2 text-slate-500">
              Patient #{patient.patient_number}
            </p>
          </div>
        </div>

        <Badge className="w-fit rounded-full px-4 py-2 text-sm">
          Active Patient
        </Badge>
      </div>
    </div>
  );
}