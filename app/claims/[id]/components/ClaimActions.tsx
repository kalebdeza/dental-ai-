"use client";

import Link from "next/link";
import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  getClaimWorkflowActions,
  getClaimWorkflowBucket,
  isClaimAging,
  type ClaimActionId,
} from "../../../../lib/data/claimWorkflow";
import {
  formatClaimAmount,
  formatClaimDate,
} from "../../../../lib/data/claimDisplay";
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
  const showFollowUp = actions.some((item) => item.id === "follow_up");
  const aging = isClaimAging(claim);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Actions</h2>
      <p className="mb-5 text-sm text-slate-500">
        Claim status is {bucket}. This app does not submit claims or contact
        payers. Notes, snooze, complete, and dismiss apply to the office queue
        item when an opportunity is linked.
        {officeStatus ? ` Office queue: ${officeStatus}.` : ""}
      </p>

      <div className="flex flex-wrap gap-3">
        {actions.map((item) => {
          const className =
            item.emphasis === "primary"
              ? "rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              : "rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400";

          if (item.href) {
            return (
              <div key={item.id}>
                <Link href={item.href} className={`${className} inline-block`}>
                  {item.label}
                </Link>
              </div>
            );
          }

          return (
            <div key={item.id} className="max-w-xs">
              <button
                type="button"
                disabled={!item.available || busy}
                title={item.unavailableReason}
                onClick={() => onAction(item.id)}
                className={className}
              >
                {busyAction === item.id ? `${item.label}…` : item.label}
              </button>
              {!item.available && item.unavailableReason ? (
                <p className="mt-1 text-xs text-slate-500">
                  {item.unavailableReason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {showFollowUp ? (
        <div
          id="claim-follow-up"
          className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-slate-800"
        >
          <p className="font-semibold">Office follow-up</p>
          <p className="mt-1">
            The office needs to contact the payer. This app does not contact
            insurance or submit claims.
          </p>
          <dl className="mt-3 grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Payer</dt>
              <dd className="font-medium">
                {claim.insurance_company?.trim() || "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{claim.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Remaining balance</dt>
              <dd className="font-medium">
                {formatClaimAmount(claim.remaining_balance)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="font-medium">
                {formatClaimDate(claim.submitted_at)}
              </dd>
            </div>
            {aging ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Aging</dt>
                <dd className="font-medium">
                  30+ days since submitted, with a remaining balance.
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

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
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
