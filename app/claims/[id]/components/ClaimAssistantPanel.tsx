import {
  NOT_AVAILABLE_IN_APP,
} from "../../../../lib/data/claimDisplay";
import type { ClaimAssistantView } from "../../../../lib/data/claimAssistant";

function FieldStatus({
  status,
  value,
}: {
  status: "available" | "missing" | "not_stored";
  value: string;
}) {
  if (status === "available") {
    return (
      <span>
        <span className="font-medium text-emerald-700">✓ Available</span>
        <span className="text-slate-700"> — {value}</span>
      </span>
    );
  }

  if (status === "missing") {
    return (
      <span>
        <span className="font-medium text-amber-700">⚠ Missing</span>
      </span>
    );
  }

  return <span className="text-slate-500">{NOT_AVAILABLE_IN_APP}</span>;
}

export default function ClaimAssistantPanel({
  view,
}: {
  view: ClaimAssistantView;
}) {
  return (
    <div className="mt-6 space-y-5">
      {view.syntheticNotice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {view.syntheticNotice}
        </p>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recommended next step
        </h3>
        <p className="mt-1 text-slate-800">{view.recommendedNextStep}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Claim facts in this app
        </h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {view.facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-slate-500">{fact.label}</dt>
              <dd className="font-medium text-slate-800">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {view.readiness ? (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Submission readiness
          </h3>
          <p className="mt-1 font-semibold text-slate-900">{view.readiness.label}</p>
          <p className="mt-2 text-sm text-slate-600">{view.disclaimer}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {view.fields.map((field) => (
              <li key={field.key} className="flex flex-wrap gap-2">
                <span className="w-48 text-slate-600">{field.label}</span>
                <FieldStatus status={field.status} value={field.value} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.followUpChecklist ? (
        <div
          id="claim-follow-up"
          className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-slate-800"
        >
          <p className="font-semibold">Office follow-up checklist</p>
          <p className="mt-1 text-slate-600">{view.disclaimer}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {view.followUpChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.bucket === "denied" ? (
        <div
          id="claim-denial"
          className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-950"
        >
          <p className="font-semibold">Stored denial reason</p>
          {view.denialUnavailable ? (
            <p className="mt-1">Denial details are not available in this app.</p>
          ) : (
            <p className="mt-1">{view.denialReason}</p>
          )}
          {view.denialExplanation ? (
            <p className="mt-3">{view.denialExplanation}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
