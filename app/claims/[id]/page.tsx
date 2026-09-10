"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getClaimWithDetails } from "../../../lib/data/claims";
import type { ClaimWithDetails } from "../../../lib/data/claims";
import {
  formatPatientName,
} from "../../../lib/data/claimDisplay";
import {
  CLAIM_PMS_GUIDANCE,
  formatClaimFollowUpGuidance,
  type ClaimActionId,
} from "../../../lib/data/claimWorkflow";
import {
  officeWorkflowSuccessMessage,
  postOfficeWorkflow,
  toSnoozeIso,
} from "../../components/postOfficeWorkflow";

import ClaimHero from "./components/ClaimHero";
import ClaimSummary from "./components/ClaimSummary";
import AIRecommendation from "./components/AIRecommendation";
import AIClaimCopilot from "./components/AIClaimCopilot";
import ClaimActions from "./components/ClaimActions";
import ClaimTimeline from "./components/ClaimTimeline";

export default function ClaimWorkspace() {
  const params = useParams();
  const router = useRouter();

  const [claim, setClaim] = useState<ClaimWithDetails | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appealLetter, setAppealLetter] = useState("");
  const [appealLoading, setAppealLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");

  useEffect(() => {
    loadClaim();
  }, []);

  async function loadClaim() {
    try {
      const data = await getClaimWithDetails(params.id as string);
      setClaim(data);
    } catch {
      console.error("Failed to load claim.");
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function generateAppeal(current: ClaimWithDetails) {
    try {
      setAppealLoading(true);
      setNotice("Generating appeal letter…");

      const response = await fetch("/api/generate-appeal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient: {
            name: formatPatientName(current.patient),
          },
          claims: [
            {
              claim_number: current.claim_number,
              status: current.status,
              amount_billed: current.amount_billed,
              amount_paid: current.amount_paid,
              remaining_balance: current.remaining_balance,
              insurance_company: current.insurance_company,
              denial_reason: current.denial_reason,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.message ?? "Appeal generation is unavailable.");
        return;
      }

      setAppealLetter(data.letter ?? "");
      setNotice("Appeal letter generated below.");
    } finally {
      setAppealLoading(false);
    }
  }

  async function runOfficeWorkflow(
    action: "add_note" | "snooze" | "complete" | "dismiss",
    extra: { snoozedUntil?: string } = {},
    busyId: string = action
  ) {
    if (!claim?.opportunity) {
      setNotice("No claim opportunity is linked, so this action cannot be saved.");
      return;
    }

    try {
      setBusyAction(busyId);
      setNotice(null);
      await postOfficeWorkflow({
        opportunityId: claim.opportunity.id,
        action,
        note: note.trim() || undefined,
        ...extra,
      });
      setNote("");
      setSnoozeUntil("");
      await loadClaim();
      setNotice(officeWorkflowSuccessMessage(action, extra));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not save this workflow action."
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleAction(id: ClaimActionId) {
    if (!claim) {
      return;
    }

    switch (id) {
      case "open_claim":
      case "view_details":
      case "view_payment":
      case "review":
        router.push(`/claims/${claim.id}`);
        return;
      case "review_denial":
        setNotice(null);
        scrollTo("claim-denial");
        return;
      case "generate_narrative":
        setNotice("Use Generate Narrative in AI Claim Copilot below.");
        scrollTo("claim-copilot");
        return;
      case "generate_appeal":
        void generateAppeal(claim);
        return;
      case "edit":
      case "submit":
      case "fix":
      case "resubmit":
        setNotice(CLAIM_PMS_GUIDANCE);
        return;
      case "follow_up":
        setNotice(formatClaimFollowUpGuidance(claim));
        scrollTo("claim-follow-up");
        return;
      case "add_note":
        if (!note.trim()) {
          setNotice("Enter a note before saving.");
          return;
        }
        void runOfficeWorkflow("add_note");
        return;
      case "set_follow_up_date":
      case "snooze": {
        const snoozedUntil = toSnoozeIso(snoozeUntil);
        if (!snoozedUntil) {
          setNotice("Choose a future snooze time.");
          return;
        }
        void runOfficeWorkflow("snooze", { snoozedUntil });
        return;
      }
      case "mark_resolved":
        void runOfficeWorkflow("complete", {}, "mark_resolved");
        return;
      case "complete":
        void runOfficeWorkflow("complete");
        return;
      case "dismiss":
        if (
          !window.confirm(
            "Dismiss this claim opportunity from the office queue? The claim record stays, and the opportunity will not come back on the next scan."
          )
        ) {
          return;
        }
        void runOfficeWorkflow("dismiss");
        return;
      default:
        return;
    }
  }

  if (!claim) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Loading claim...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <ClaimHero claim={claim} />

      <div className="grid gap-6 lg:grid-cols-3">
        <ClaimSummary claim={claim} />

        <div className="space-y-6 lg:col-span-2">
          <AIRecommendation claim={claim} />
          <ClaimActions
            claim={claim}
            onAction={handleAction}
            notice={
              appealLoading ? "Generating appeal letter…" : notice
            }
            busyAction={busyAction}
            note={note}
            snoozeUntil={snoozeUntil}
            onNoteChange={setNote}
            onSnoozeUntilChange={setSnoozeUntil}
          />
        </div>
      </div>

      <ClaimTimeline claim={claim} />

      <div id="claim-copilot">
        <AIClaimCopilot claim={claim} generatedLetter={appealLetter} />
      </div>
    </main>
  );
}
