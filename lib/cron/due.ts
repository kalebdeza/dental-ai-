export type PracticeJobType =
  | "sync"
  | "claim"
  | "recall"
  | "treatment";

export type PracticeJobDue = Record<PracticeJobType, boolean>;

const DEFAULT_FREQUENCY_MINUTES = 15;
const MINUTE_MS = 60_000;

export function resolveSyncFrequencyMinutes(
  value: number | null | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return DEFAULT_FREQUENCY_MINUTES;
  }

  return value;
}

export function isTimestampDue(
  timestamp: string | null | undefined,
  frequencyMinutes: number,
  now: Date
): boolean {
  if (!timestamp) {
    return true;
  }

  const last = Date.parse(timestamp);

  if (Number.isNaN(last)) {
    return true;
  }

  return last + frequencyMinutes * MINUTE_MS <= now.getTime();
}

export function getDueJobs(input: {
  syncFrequencyMinutes: number;
  lastSyncAt: string | null;
  lastClaimScanAt: string | null;
  lastRecallScanAt: string | null;
  lastTreatmentScanAt: string | null;
  now?: Date;
}): PracticeJobDue {
  const frequency = resolveSyncFrequencyMinutes(
    input.syncFrequencyMinutes
  );
  const now = input.now ?? new Date();

  return {
    sync: isTimestampDue(input.lastSyncAt, frequency, now),
    claim: isTimestampDue(input.lastClaimScanAt, frequency, now),
    recall: isTimestampDue(input.lastRecallScanAt, frequency, now),
    treatment: isTimestampDue(input.lastTreatmentScanAt, frequency, now),
  };
}

export function hasDueJob(due: PracticeJobDue): boolean {
  return due.sync || due.claim || due.recall || due.treatment;
}
