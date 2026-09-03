import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import { formatPatientName } from "../../../../lib/data/claimDisplay";

interface ClaimHeroProps {
  claim: ClaimWithDetails;
}

export default function ClaimHero({ claim }: ClaimHeroProps) {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 p-8 text-white shadow-lg">

      <Link
        href="/claims"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Claims
      </Link>

      <div className="flex items-center gap-5">

        <div className="rounded-2xl bg-white/10 p-4">
          <FileText className="h-10 w-10" />
        </div>

        <div>

          <p className="text-sm uppercase tracking-wider text-slate-300">
            Insurance Claim
          </p>

          <h1 className="mt-1 text-4xl font-bold">
            {formatPatientName(claim.patient)}
          </h1>

          <p className="mt-2 text-slate-300">
            Claim #{claim.claim_number ?? "Not available"}
          </p>

        </div>

      </div>

    </div>
  );
}
