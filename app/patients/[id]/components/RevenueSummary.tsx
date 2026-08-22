import { DollarSign, Stethoscope, FileText, Phone } from "lucide-react";

interface RevenueSummaryProps {
  totalRevenue: number;
  treatmentRevenue: number;
  claimRevenue: number;
  recallRevenue: number;
}

export default function RevenueSummary({
  totalRevenue,
  treatmentRevenue,
  claimRevenue,
  recallRevenue,
}: RevenueSummaryProps) {
  return (
    <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <DollarSign className="h-8 w-8" />
        <div>
          <p className="text-sm uppercase tracking-wide text-blue-100">
            Total Recoverable Revenue
          </p>

          <h2 className="mt-2 text-5xl font-bold">
            ${totalRevenue.toLocaleString()}
          </h2>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-4">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <span className="text-sm">Treatment</span>
          </div>

          <p className="mt-3 text-2xl font-bold">
            ${treatmentRevenue.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span className="text-sm">Claims</span>
          </div>

          <p className="mt-3 text-2xl font-bold">
            ${claimRevenue.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            <span className="text-sm">Recalls</span>
          </div>

          <p className="mt-3 text-2xl font-bold">
            ${recallRevenue.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}