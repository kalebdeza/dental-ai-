import type { ClaimWithDetails } from "../../../../lib/data/claims";
import { formatClaimDate } from "../../../../lib/data/claimDisplay";
import { buildClaimTimeline } from "../../../../lib/data/claimWorkflow";
import {
  formatActivityTimestamp,
  mapOpportunityActivities,
} from "../../../../lib/data/opportunityActivityDisplay";

interface Props {
  claim: ClaimWithDetails;
}

export default function ClaimTimeline({ claim }: Props) {
  const events = buildClaimTimeline(claim);
  const activities = mapOpportunityActivities(claim.activities ?? []);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-bold">Claim activity</h2>

      <ol className="space-y-4">
        {events.map((event, index) => (
          <li key={`${event.label}-${index}`} className="flex gap-4">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
            <div>
              <p className="font-medium">{event.label}</p>
              <p className="text-sm text-slate-500">
                {event.at ? formatClaimDate(event.at) : "Date not recorded"}
              </p>
              {event.detail ? (
                <p className="mt-1 text-sm text-slate-700">{event.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <h3 className="mb-3 mt-8 text-lg font-semibold">Office workflow</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-slate-500">
          No office workflow activity has been recorded yet.
        </p>
      ) : (
        <ol className="space-y-4">
          {activities.map((item) => (
            <li key={item.id} className="flex gap-4">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <div>
                <p className="font-medium">{item.eventLabel}</p>
                <p className="text-sm text-slate-500">
                  {formatActivityTimestamp(item.timestamp)}
                </p>
                {item.statusTransition ? (
                  <p className="mt-1 text-sm text-slate-700">
                    {item.statusTransition}
                  </p>
                ) : null}
                {item.note ? (
                  <p className="mt-1 text-sm text-slate-700">{item.note}</p>
                ) : null}
                {item.snoozedUntil ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Snoozed until {formatActivityTimestamp(item.snoozedUntil)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
