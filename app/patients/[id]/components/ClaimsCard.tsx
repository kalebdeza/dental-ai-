import { FileText } from "lucide-react";

interface ClaimsCardProps {
  claims: any[];
}

export default function ClaimsCard({
  claims,
}: ClaimsCardProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <FileText className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-semibold">
          Insurance Claims
        </h2>
      </div>

      {claims.length ? (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="rounded-xl border p-4 transition hover:border-indigo-300"
            >
              <div className="font-semibold">
                {claim.reason ??
                  "Insurance claim opportunity"}
              </div>

              <div className="mt-2 text-2xl font-bold text-green-600">
                $
                {Number(
                  claim.estimated_value ?? 0
                ).toLocaleString()}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                Priority: {claim.priority}
              </div>

              {claim.recommended_action && (
                <div className="mt-2 text-sm text-slate-600">
                  {claim.recommended_action}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">
          No outstanding claims.
        </p>
      )}
    </section>
  );
}