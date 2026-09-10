"use client";

import { useState } from "react";
import {
  Brain,
  Copy,
  DollarSign,
  Loader2,
} from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  formatClaimAmount,
} from "../../../../lib/data/claimDisplay";
import { getClaimWorkflowBucket } from "../../../../lib/data/claimWorkflow";

interface Props {
  claim: ClaimWithDetails;
  generatedLetter: string;
  narrative: string;
  supportingNotes: string;
  narrativeLoading: boolean;
  supportingNotesLoading: boolean;
  onGenerateNarrative: () => void;
  onGenerateSupportingNotes: () => void;
}

export default function AIClaimCopilot({
  claim,
  generatedLetter,
  narrative,
  supportingNotes,
  narrativeLoading,
  supportingNotesLoading,
  onGenerateNarrative,
  onGenerateSupportingNotes,
}: Props) {
  const remaining = Number(claim.remaining_balance);
  const bucket = getClaimWorkflowBucket(claim);
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
  }

  const showNarrative = bucket === "draft" || bucket === "denied";
  const showSupportingNotes = bucket === "draft";
  const letter = generatedLetter.trim();
  const hasAiActions = showNarrative || showSupportingNotes;
  const hasGeneratedOutput = Boolean(narrative || supportingNotes || letter);

  if (!hasAiActions && !hasGeneratedOutput) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl">
      <div className="mb-6 flex items-center gap-3">
        <Brain className="h-7 w-7 text-cyan-400" />
        <h2 className="text-2xl font-bold">AI Claim Copilot</h2>
      </div>

      <p className="text-slate-300">
        These tools use stored claim data only. They do not submit claims,
        contact payers, or invent missing clinical details.
      </p>

      <div className="mt-8 space-y-5">
        <div className="rounded-xl bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold">Remaining balance</span>
          </div>
          <div className="mt-3 text-4xl font-bold text-emerald-400">
            {formatClaimAmount(remaining)}
          </div>
        </div>

        {showNarrative ? (
          <button
            type="button"
            onClick={onGenerateNarrative}
            disabled={narrativeLoading || supportingNotesLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium hover:bg-blue-700 disabled:bg-slate-600"
          >
            {narrativeLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Narrative"
            )}
          </button>
        ) : null}

        {showSupportingNotes ? (
          <button
            type="button"
            onClick={onGenerateSupportingNotes}
            disabled={narrativeLoading || supportingNotesLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 py-3 font-medium hover:bg-slate-600 disabled:bg-slate-600"
          >
            {supportingNotesLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Supporting Notes"
            )}
          </button>
        ) : null}

        {narrative ? (
          <GeneratedBlock
            title="Insurance Narrative"
            value={narrative}
            copied={copied === "narrative"}
            onCopy={() => copyText(narrative, "narrative")}
          />
        ) : null}

        {supportingNotes ? (
          <GeneratedBlock
            title="Supporting Notes"
            value={supportingNotes}
            copied={copied === "notes"}
            onCopy={() => copyText(supportingNotes, "notes")}
          />
        ) : null}

        {letter ? (
          <GeneratedBlock
            title="Appeal letter"
            value={letter}
            copied={copied === "appeal"}
            onCopy={() => copyText(letter, "appeal")}
          />
        ) : null}
      </div>
    </div>
  );
}

function GeneratedBlock({
  title,
  value,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-slate-300">{value}</p>
    </div>
  );
}
