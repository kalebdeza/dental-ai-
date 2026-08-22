import { Stethoscope } from "lucide-react";

interface TreatmentCardProps {
  treatments: any[];
}

export default function TreatmentCard({
  treatments,
}: TreatmentCardProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <Stethoscope className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold">
          Treatment Opportunities
        </h2>
      </div>

      {treatments.length ? (
        <div className="space-y-4">
          {treatments.map((treatment) => (
            <div
              key={treatment.id}
              className="rounded-xl border p-4 transition hover:border-blue-300"
            >
              <div className="font-semibold">
                {treatment.reason ??
                  "Treatment opportunity"}
              </div>

              <div className="mt-2 text-2xl font-bold text-green-600">
                $
                {Number(
                  treatment.estimated_value ?? 0
                ).toLocaleString()}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                Priority: {treatment.priority}
              </div>

              {treatment.recommended_action && (
                <div className="mt-2 text-sm text-slate-600">
                  {treatment.recommended_action}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">
          No treatment opportunities.
        </p>
      )}
    </section>
  );
}