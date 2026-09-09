"use client";

import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Phone,
  StickyNote,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type OfficeActionId =
  | "call"
  | "schedule"
  | "mark_contacted"
  | "add_note"
  | "snooze"
  | "complete"
  | "dismiss";

export type OfficeWorkflowActionItem = {
  id: OfficeActionId;
  label: string;
  emphasis: "primary" | "secondary" | "destructive";
  available: boolean;
  unavailableReason?: string;
};

export type OfficeContactOutcomeItem = {
  id: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

const ACTION_ICONS = {
  call: Phone,
  schedule: CalendarPlus,
  mark_contacted: UserCheck,
  add_note: StickyNote,
  snooze: Clock,
  complete: CheckCircle2,
  dismiss: Ban,
} as const;

type Props = {
  title?: string;
  description: string;
  actions: OfficeWorkflowActionItem[];
  contactOutcomes: OfficeContactOutcomeItem[];
  telHref: string | null;
  notice: string | null;
  busyAction: string | null;
  note: string;
  snoozeUntil: string;
  onNoteChange: (value: string) => void;
  onSnoozeUntilChange: (value: string) => void;
  onAction: (id: OfficeActionId) => void;
  onContactOutcome: (id: string) => void;
};

export default function OfficeWorkflowActions({
  title = "Next action",
  description,
  actions,
  contactOutcomes,
  telHref,
  notice,
  busyAction,
  note,
  snoozeUntil,
  onNoteChange,
  onSnoozeUntilChange,
  onAction,
  onContactOutcome,
}: Props) {
  const busy = Boolean(busyAction);

  return (
    <div
      className="mt-6 rounded-[20px] bg-white p-9"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,.08)" }}
    >
      <h2 className="mb-1 text-xl font-bold">{title}</h2>
      <p className="mb-5 text-sm text-slate-500">{description}</p>

      <div className="flex flex-wrap gap-3">
        {actions.map((item) => {
          const Icon = ACTION_ICONS[item.id];
          const className = "h-auto rounded-xl px-4 py-3 text-sm font-semibold";
          const isBusy = busyAction === item.id;

          if (item.id === "call" && item.available && telHref) {
            return (
              <Button key={item.id} asChild size="lg" className={className}>
                <a href={telHref}>
                  <Icon />
                  {item.label}
                </a>
              </Button>
            );
          }

          return (
            <Button
              key={item.id}
              type="button"
              size="lg"
              variant={
                item.emphasis === "destructive"
                  ? "destructive"
                  : item.emphasis === "primary"
                    ? "default"
                    : "outline"
              }
              disabled={!item.available || busy}
              title={item.unavailableReason}
              onClick={() => onAction(item.id)}
              className={className}
            >
              <Icon />
              {isBusy ? `${item.label}…` : item.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-slate-500">
          Contact outcomes
        </p>
        <p className="mb-3 text-xs text-slate-500">
          These are office outcomes. Scheduled means the office scheduled the
          patient in the practice system, not that this app created an
          appointment.
        </p>
        <div className="flex flex-wrap gap-2">
          {contactOutcomes.map((outcome) => (
            <Button
              key={outcome.id}
              type="button"
              variant="outline"
              disabled={!outcome.available || busy}
              title={outcome.unavailableReason}
              onClick={() => onContactOutcome(outcome.id)}
              className="h-auto rounded-xl px-3 py-2 text-sm"
            >
              {busyAction === `outcome:${outcome.id}`
                ? `${outcome.label}…`
                : outcome.label}
            </Button>
          ))}
        </div>
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
          <span className="mt-2 block text-xs font-normal text-slate-500">
            Must be a future time. The opportunity stays in its current
            workflow status and leaves the queue until then.
          </span>
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
