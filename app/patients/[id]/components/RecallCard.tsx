import { Phone } from "lucide-react";

interface RecallCardProps {
  recalls: any[];
}

export default function RecallCard({
  recalls,
}: RecallCardProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <Phone className="h-6 w-6 text-purple-600" />
        <h2 className="text-xl font-semibold">
          Recall Opportunities
        </h2>
      </div>

      {recalls.length ? (
        <div className="space-y-4">
          {recalls.map((recall) => (
            <div
              key={recall.id}
              className="rounded-xl border p-4 transition hover:border-purple-300"
            >
              <div className="font-semibold">
                {recall.reason ??
                  "Overdue recall opportunity"}
              </div>

              <div className="mt-2 text-2xl font-bold text-green-600">
                $
                {Number(
                  recall.estimated_value ?? 0
                ).toLocaleString()}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                Priority: {recall.priority}
              </div>

              {recall.recommended_action && (
                <div className="mt-2 text-sm text-slate-600">
                  {recall.recommended_action}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">
          No recalls due.
        </p>
      )}
    </section>
  );
}