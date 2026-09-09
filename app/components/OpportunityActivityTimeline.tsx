"use client";

import {
  formatActivityTimestamp,
  mapOpportunityActivities,
} from "@/lib/data/opportunityActivityDisplay";
import type { OpportunityActivityRow } from "@/lib/data/opportunityWorkflow";

type Props = {
  title?: string;
  emptyText?: string;
  activities: OpportunityActivityRow[];
};

export default function OpportunityActivityTimeline({
  title = "Activity",
  emptyText = "No workflow activity has been recorded yet.",
  activities,
}: Props) {
  const items = mapOpportunityActivities(activities);

  return (
    <div
      className="mt-6 rounded-[20px] bg-white p-9"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,.08)" }}
    >
      <h2 className="mb-1 text-xl font-bold">{title}</h2>
      <p className="mb-5 text-sm text-slate-500">
        History starts from the first saved action. Older records do not have
        invented events.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ol className="space-y-4">
          {items.map((item) => (
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
                {item.contactOutcome ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Outcome: {item.contactOutcome}
                  </p>
                ) : null}
                {item.snoozedUntil ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Snoozed until {formatActivityTimestamp(item.snoozedUntil)}
                  </p>
                ) : null}
                {item.note ? (
                  <p className="mt-1 text-sm text-slate-700">{item.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
