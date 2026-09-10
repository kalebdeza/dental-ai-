import type { Tables } from "../database.types.ts";
import {
  CLAIM_STATUS,
  isClaimAwaitingSubmission,
} from "../opendental/status.ts";
import {
  formatClaimAmount,
  formatClaimDate,
} from "./claimDisplay.ts";
import {
  isOfficeWorkflowTerminal,
  readStoredWorkflowStatus,
} from "./opportunityWorkflow.ts";

type Claim = Tables<"claims">;

export type ClaimWorkflowBucket =
  | "draft"
  | "sent"
  | "denied"
  | "paid"
  | "outstanding"
  | "unknown";

export type ClaimActionId =
  | "review"
  | "edit"
  | "submit"
  | "follow_up"
  | "add_note"
  | "view_details"
  | "open_claim"
  | "review_denial"
  | "fix"
  | "resubmit"
  | "generate_appeal"
  | "generate_narrative"
  | "view_payment"
  | "mark_resolved"
  | "set_follow_up_date"
  | "snooze"
  | "dismiss"
  | "complete";

export type ClaimActionKind = "workflow" | "navigate" | "guidance" | "in_page";

export type ClaimWorkflowAction = {
  id: ClaimActionId;
  label: string;
  emphasis: "primary" | "secondary";
  available: boolean;
  unavailableReason?: string;
  href?: string;
  kind: ClaimActionKind;
};

export type ClaimNextAction = {
  title: string;
  what: string;
  why: string;
  recommendedAction: string;
  source: "opportunity" | "status";
};

export type ClaimTimelineEvent = {
  label: string;
  at: string | null;
  detail?: string;
};

export type ClaimOpportunitySummary = {
  id?: string;
  reason: string | null;
  recommended_action: string | null;
  estimated_value?: number;
  priority?: string;
  completed?: boolean;
  workflow_status?: string;
  snoozed_until?: string | null;
};

const NOTE_NO_OPPORTUNITY =
  "No claim opportunity is linked, so a note cannot be saved on this claim.";

const SNOOZE_NO_OPPORTUNITY =
  "No claim opportunity is linked, so this claim cannot be snoozed.";

const SNOOZE_TERMINAL =
  "This claim opportunity is already completed or dismissed.";

const COMPLETE_NO_OPPORTUNITY =
  "No claim opportunity is linked, so this queue item cannot be completed here. Claim status still comes from Open Dental.";

const DISMISS_NO_OPPORTUNITY =
  "No claim opportunity is linked, so this queue item cannot be dismissed.";

function hasDenialReason(claim: Claim): boolean {
  return Boolean(claim.denial_reason?.trim());
}

function isPaidDown(claim: Claim): boolean {
  return (
    Number(claim.remaining_balance) <= 0 &&
    (Number(claim.amount_paid) > 0 || Boolean(claim.paid_at))
  );
}

export function isClaimAging(
  claim: Pick<Claim, "submitted_at" | "remaining_balance">,
  now: Date = new Date()
): boolean {
  if (!claim.submitted_at || Number(claim.remaining_balance) <= 0) {
    return false;
  }

  const submitted = Date.parse(claim.submitted_at);

  if (Number.isNaN(submitted)) {
    return false;
  }

  return now.getTime() - submitted >= 30 * 24 * 60 * 60 * 1000;
}

export function getClaimWorkflowBucket(
  claim: Claim,
  _now: Date = new Date()
): ClaimWorkflowBucket {
  if (hasDenialReason(claim)) {
    return "denied";
  }

  if (isPaidDown(claim)) {
    return "paid";
  }

  if (isClaimAwaitingSubmission(claim.status)) {
    return "draft";
  }

  if (Number(claim.remaining_balance) > 0) {
    return "outstanding";
  }

  if (claim.status === CLAIM_STATUS.Sent) {
    return "sent";
  }

  if (claim.status === CLAIM_STATUS.Received) {
    return "paid";
  }

  return "unknown";
}

export const CLAIM_PMS_GUIDANCE =
  "This is done in your PMS. The app doesn't currently edit, submit, or resubmit insurance claims.";

function action(
  id: ClaimActionId,
  label: string,
  emphasis: "primary" | "secondary",
  available = true,
  unavailableReason?: string,
  extra: { href?: string; kind?: ClaimActionKind } = {}
): ClaimWorkflowAction {
  return {
    id,
    label,
    emphasis,
    available,
    unavailableReason,
    href: extra.href,
    kind: extra.kind ?? (available ? "workflow" : "guidance"),
  };
}

export function formatClaimFollowUpGuidance(
  claim: Claim,
  now: Date = new Date()
): string {
  const aging = isClaimAging(claim, now);
  const lines = [
    "The office needs to contact the payer. This app does not contact insurance or submit claims.",
    `Payer: ${claim.insurance_company?.trim() || "Not available"}`,
    `Status: ${claim.status}`,
    `Remaining balance: ${formatClaimAmount(claim.remaining_balance)}`,
    `Submitted: ${formatClaimDate(claim.submitted_at)}`,
  ];

  if (aging) {
    lines.push("Aging: 30+ days since submitted, with a remaining balance.");
  }

  return lines.join("\n");
}

export function getClaimWorkflowActions(
  claim: Claim,
  opportunity: ClaimOpportunitySummary | null | undefined = null,
  now: Date = new Date()
): ClaimWorkflowAction[] {
  const bucket = getClaimWorkflowBucket(claim, now);
  const status = opportunity
    ? readStoredWorkflowStatus({
        workflow_status: opportunity.workflow_status ?? "open",
        completed: opportunity.completed ?? false,
      })
    : null;
  const terminal = status ? isOfficeWorkflowTerminal(status) : true;
  const hasOpportunity = Boolean(opportunity);
  const canSnooze = hasOpportunity && !terminal;
  const canComplete = hasOpportunity && !terminal;
  const canDismiss = hasOpportunity && !terminal;
  const canNote = hasOpportunity;

  const officeActions: ClaimWorkflowAction[] = [
    action(
      "add_note",
      "Add Note",
      "secondary",
      canNote,
      canNote ? undefined : NOTE_NO_OPPORTUNITY,
      { kind: "workflow" }
    ),
    action(
      "snooze",
      "Snooze",
      "secondary",
      canSnooze,
      hasOpportunity ? (terminal ? SNOOZE_TERMINAL : undefined) : SNOOZE_NO_OPPORTUNITY,
      { kind: "workflow" }
    ),
    action(
      "complete",
      "Complete",
      "secondary",
      canComplete,
      hasOpportunity ? (terminal ? SNOOZE_TERMINAL : undefined) : COMPLETE_NO_OPPORTUNITY,
      { kind: "workflow" }
    ),
    action(
      "dismiss",
      "Dismiss",
      "secondary",
      canDismiss,
      hasOpportunity ? (terminal ? SNOOZE_TERMINAL : undefined) : DISMISS_NO_OPPORTUNITY,
      { kind: "workflow" }
    ),
  ];

  const openClaim = action(
    "open_claim",
    "Open Claim",
    "secondary",
    true,
    undefined,
    { href: `/claims/${claim.id}`, kind: "navigate" }
  );

  const submitInPms = action(
    "submit",
    "Submit in PMS",
    "secondary",
    true,
    undefined,
    { kind: "guidance" }
  );

  const fixInPms = action(
    "fix",
    "Fix in PMS",
    "secondary",
    true,
    undefined,
    { kind: "guidance" }
  );

  switch (bucket) {
    case "draft":
      return [
        openClaim,
        submitInPms,
        action("generate_narrative", "Generate Narrative", "secondary", true, undefined, {
          kind: "in_page",
        }),
        ...officeActions,
      ];
    case "sent":
      return [
        action("follow_up", "Follow Up", "primary", true, undefined, {
          kind: "guidance",
        }),
        openClaim,
        ...officeActions,
      ];
    case "denied":
      return [
        action("review_denial", "Review Denial", "primary", true, undefined, {
          kind: "in_page",
        }),
        action("generate_appeal", "Generate Appeal", "primary", true, undefined, {
          kind: "in_page",
        }),
        fixInPms,
        ...officeActions,
      ];
    case "paid":
      return [
        { ...openClaim, emphasis: "primary" },
        action(
          "mark_resolved",
          "Mark Resolved",
          "secondary",
          canComplete,
          hasOpportunity
            ? terminal
              ? SNOOZE_TERMINAL
              : undefined
            : COMPLETE_NO_OPPORTUNITY,
          { kind: "workflow" }
        ),
        ...officeActions.filter((item) => item.id !== "complete"),
      ];
    case "outstanding":
      return [
        action("follow_up", "Follow Up", "primary", true, undefined, {
          kind: "guidance",
        }),
        openClaim,
        ...officeActions,
      ];
    default:
      return [
        { ...openClaim, emphasis: "primary" },
        ...officeActions,
      ];
  }
}

export function getClaimNextAction(
  claim: Claim,
  opportunity: ClaimOpportunitySummary | null | undefined,
  now: Date = new Date()
): ClaimNextAction {
  const reason = opportunity?.reason?.trim();
  const recommended = opportunity?.recommended_action?.trim();

  if (reason && recommended) {
    return {
      title: "AI Next Action",
      what: recommended,
      why: reason,
      recommendedAction: recommended,
      source: "opportunity",
    };
  }

  const bucket = getClaimWorkflowBucket(claim, now);
  const aging = isClaimAging(claim, now);

  switch (bucket) {
    case "draft":
      return {
        title: "AI Next Action",
        what: "Review this claim and submit it to insurance.",
        why: "The claim has not been sent to the payer yet.",
        recommendedAction: "Open Claim, then submit it from your PMS.",
        source: "status",
      };
    case "sent":
      return {
        title: "AI Next Action",
        what: "Follow up with the payer on this submitted claim.",
        why: "The claim has been sent and is waiting on insurance.",
        recommendedAction: "Follow up with the payer. This app does not contact insurance.",
        source: "status",
      };
    case "denied":
      return {
        title: "AI Next Action",
        what: "Review the denial and prepare an appeal if the charge is still valid.",
        why:
          claim.denial_reason?.trim() ??
          "A denial reason is recorded on this claim.",
        recommendedAction: "Review Denial, then Generate Appeal.",
        source: "status",
      };
    case "paid":
      return {
        title: "AI Next Action",
        what: "Confirm the payment posted and close the workspace item.",
        why: "This claim has payment recorded and no remaining balance.",
        recommendedAction: "Open Claim to review payment details.",
        source: "status",
      };
    case "outstanding":
      return {
        title: "AI Next Action",
        what: aging
          ? "Follow up on this aging outstanding balance."
          : "Follow up on the outstanding insurance balance.",
        why: aging
          ? "The claim still has a remaining balance more than 30 days after submission."
          : "The claim still has a remaining insurance balance.",
        recommendedAction: "Follow up with the payer. This app does not contact insurance.",
        source: "status",
      };
    default:
      return {
        title: "AI Next Action",
        what: "Review the claim details before taking action.",
        why: "This claim status is not one of the known Open Dental workflow states.",
        recommendedAction: "Open Claim.",
        source: "status",
      };
  }
}

export function buildClaimTimeline(claim: Claim): ClaimTimelineEvent[] {
  const events: ClaimTimelineEvent[] = [
    { label: "Created", at: claim.created_at },
  ];

  if (claim.submitted_at) {
    events.push({ label: "Submitted", at: claim.submitted_at });
  }

  if (claim.denial_reason?.trim()) {
    events.push({
      label: "Denied",
      at: null,
      detail: claim.denial_reason.trim(),
    });
  }

  if (claim.paid_at) {
    events.push({ label: "Paid", at: claim.paid_at });
  }

  if (claim.last_action?.trim()) {
    events.push({
      label: "Last action",
      at: null,
      detail: claim.last_action.trim(),
    });
  }

  return events;
}
