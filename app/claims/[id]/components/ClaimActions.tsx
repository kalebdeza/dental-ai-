"use client";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  getClaimWorkflowActions,
  getClaimWorkflowBucket,
  type ClaimActionId,
} from "../../../../lib/data/claimWorkflow";
import { formatWorkflowStatusLabel, readStoredWorkflowStatus } from "../../../../lib/data/opportunityWorkflow";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  claim: ClaimWithDetails;
  onAction: (id: ClaimActionId) => void;
  notice: string | null;
  busyAction: string | null;
  note: string;
  snoozeUntil: string;
  onNoteChange: (value: string) => void;
  onSnoozeUntilChange: (value: string) => void;
}

export default function ClaimActions({
  claim,
  onAction,
  notice,
  busyAction,
  note,
  snoozeUntil,
  onNoteChange,
  onSnoozeUntilChange,
}: Props) {
  const actions = getClaimWorkflowActions(claim, claim.opportunity);
  const bucket = getClaimWorkflowBucket(claim);
  const officeStatus = claim.opportunity
    ? formatWorkflowStatusLabel(
        readStoredWorkflowStatus({
          workflow_status: claim.opportunity.workflow_status,
          completed: claim.opportunity.completed,
        })
      )
    : null;
  const busy = Boolean(busyAction);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Actions</h2>
      <p className="mb-5 text-sm text-slate-500">
        Claim status is {bucket}. This app does not submit claims to payers.
        Notes, snooze, complete, and dismiss apply to the office queue item
        when an opportunity is linked.
        {officeStatus ? ` Office queue: ${officeStatus}.` : ""}
      </p>

      <div className="flex flex-wrap gap-3">
        {actions.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.available || busy}
            title={item.unavailableReason}
            onClick={() => onAction(item.id)}
            className={
              item.emphasis === "primary"
                ? "rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                : "rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            }
          >
            {busyAction === item.id ? `${item.label}…` : item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-500">
          Note
          <Textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add a note before saving"
            className="mt-2 min-h-24"
            disabled={busy}
          />
        </label>
        <label className="text-sm font-semibold text-slate-500">
          Snooze until
          <Input
            type="datetime-local"
            value={snoozeUntil}
            onChange={(event) => onSnoozeUntilChange(event.target.value)}
            className="mt-2 h-10"
            disabled={busy}
          />
        </label>
      </div>

      {notice ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
