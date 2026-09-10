"use client";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import { buildClaimAssistantView } from "../../../../lib/data/claimAssistant";
import {
  getClaimWorkflowActions,
  type ClaimActionId,
} from "../../../../lib/data/claimWorkflow";
import { formatWorkflowStatusLabel, readStoredWorkflowStatus } from "../../../../lib/data/opportunityWorkflow";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ClaimAssistantPanel from "./ClaimAssistantPanel";

interface Props {
  claim: ClaimWithDetails;
  onAction: (id: ClaimActionId) => void;
  notice: string | null;
  busyAction: string | null;
  note: string;
  snoozeUntil: string;
  onNoteChange: (value: string) => void;
  onSnoozeUntilChange: (value: string) => void;
  generatedNarrative: string;
  generatedSupportingNotes: string;
  generatedAppeal: string;
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
  generatedNarrative,
  generatedSupportingNotes,
  generatedAppeal,
}: Props) {
  const actions = getClaimWorkflowActions(claim, claim.opportunity);
  const view = buildClaimAssistantView({
    claim,
    patient: claim.patient,
    provider: claim.provider,
    opportunity: claim.opportunity,
  });
  const officeStatus = claim.opportunity
    ? formatWorkflowStatusLabel(
        readStoredWorkflowStatus({
          workflow_status: claim.opportunity.workflow_status,
          completed: claim.opportunity.completed,
        })
      )
    : null;
  const busy = Boolean(busyAction);
  const showOfficeInputs = actions.some(
    (item) => item.id === "add_note" || item.id === "snooze"
  );

  return (
    <div id="claim-assistant-output" className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-bold">{view.title}</h2>
      <p className="mb-5 text-sm text-slate-500">
        This app can generate text from stored claim data and record office
        notes. It does not submit claims, contact payers, or create appointments.
        {officeStatus ? ` Office queue: ${officeStatus}.` : ""}
      </p>

      <div className="flex flex-wrap gap-3">
        {actions.map((item) => {
          const className =
            item.emphasis === "primary"
              ? "rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              : "rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400";

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

      {generatedNarrative || generatedSupportingNotes || generatedAppeal ? (
        <div className="mt-6 space-y-4">
          {generatedNarrative ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Generated narrative</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">
                {generatedNarrative}
              </p>
            </div>
          ) : null}
          {generatedSupportingNotes ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Generated supporting notes</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">
                {generatedSupportingNotes}
              </p>
            </div>
          ) : null}
          {generatedAppeal ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Generated appeal</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">
                {generatedAppeal}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ClaimAssistantPanel view={view} />

      {showOfficeInputs ? (
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
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
