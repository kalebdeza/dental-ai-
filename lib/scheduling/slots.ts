import type { OfferedSlot } from "./types.ts";

const SLOT_HOUR_STARTS = [10, 15] as const;
const SLOT_MINUTES = 60;
const MAX_LOOKAHEAD_DAYS = 14;

export type BusyInterval = {
  start: string;
  end: string;
};

function atZone(now: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return {
    y: Number(lookup.year),
    m: Number(lookup.month),
    d: Number(lookup.day),
  };
}

function zonedDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const asZone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  }).formatToParts(utcGuess);
  const zoneHour = Number(
    asZone.find((part) => part.type === "hour")?.value ?? hour
  );
  const zoneMinute = Number(
    asZone.find((part) => part.type === "minute")?.value ?? minute
  );
  const driftMinutes = (zoneHour - hour) * 60 + (zoneMinute - minute);
  return new Date(utcGuess.getTime() - driftMinutes * 60_000);
}

function isWeekend(date: Date, timeZone: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

function overlaps(
  start: Date,
  end: Date,
  busy: BusyInterval[]
): boolean {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return busy.some((interval) => {
    const busyStart = Date.parse(interval.start);
    const busyEnd = Date.parse(interval.end);
    if (!Number.isFinite(busyStart) || !Number.isFinite(busyEnd)) {
      return false;
    }
    return startMs < busyEnd && endMs > busyStart;
  });
}

export function formatSlotLabel(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

export function nextDemoSlots(
  busy: BusyInterval[],
  count = 2,
  now = new Date(),
  timeZone = "UTC"
): OfferedSlot[] {
  const slots: OfferedSlot[] = [];
  const today = atZone(now, timeZone);

  for (let dayOffset = 1; dayOffset <= MAX_LOOKAHEAD_DAYS; dayOffset += 1) {
    const cursor = zonedDate(
      timeZone,
      today.y,
      today.m,
      today.d + dayOffset,
      12,
      0
    );

    if (isWeekend(cursor, timeZone)) {
      continue;
    }

    const dayParts = atZone(cursor, timeZone);

    for (const hour of SLOT_HOUR_STARTS) {
      const start = zonedDate(
        timeZone,
        dayParts.y,
        dayParts.m,
        dayParts.d,
        hour,
        0
      );
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);

      if (start.getTime() <= now.getTime()) {
        continue;
      }

      if (overlaps(start, end, busy)) {
        continue;
      }

      slots.push({
        index: slots.length + 1,
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatSlotLabel(start, timeZone),
      });

      if (slots.length >= count) {
        return slots;
      }
    }
  }

  return slots;
}

export function slotByIndex(
  slots: OfferedSlot[],
  index: number
): OfferedSlot | null {
  return slots.find((slot) => slot.index === index) ?? null;
}
