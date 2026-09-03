import type { PracticeJobDue } from "./due";

export type PracticeJobStepResult =
  | { status: "succeeded" }
  | { status: "failed" }
  | { status: "not_implemented" };

export type PracticeJobSequenceSteps = {
  sync: () => Promise<PracticeJobStepResult>;
  claim: () => Promise<PracticeJobStepResult>;
  recall: () => Promise<PracticeJobStepResult>;
  treatment: () => Promise<PracticeJobStepResult>;
};

/**
 * Enforces sync → claim → recall → treatment.
 *
 * If sync is due, it must report succeeded before any scan runs.
 * A failed or not-implemented sync skips claim, recall, and treatment.
 * Claim/recall failures (throw or failed status) do not skip later scans.
 * Treatment never runs when sync did not succeed.
 */
export async function runPracticeJobSequence(
  due: PracticeJobDue,
  steps: PracticeJobSequenceSteps
): Promise<void> {
  if (due.sync) {
    const result = await steps.sync();

    if (result.status !== "succeeded") {
      return;
    }
  }

  if (due.claim) {
    try {
      await steps.claim();
    } catch {
      // Claim failures must not block recall or treatment.
    }
  }

  if (due.recall) {
    try {
      await steps.recall();
    } catch {
      // Recall failures must not block treatment.
    }
  }

  if (due.treatment) {
    try {
      await steps.treatment();
    } catch {
      // Isolated; sync already succeeded.
    }
  }
}
