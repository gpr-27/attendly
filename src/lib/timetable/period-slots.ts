/**
 * Daily period template helpers — college-style fixed slots in Settings.
 * Quick-add picks a slotIndex; series still store concrete start/end times.
 */

import {
  defaultPeriodSlots,
  type PeriodSlot,
  type Settings,
} from "@/lib/db/types";

const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_PERIODS = 12;

export function isValidPeriodTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Minutes since midnight for HH:mm, or null if invalid. */
export function timeToMinutes(value: string): number | null {
  if (!isValidPeriodTime(value)) return null;
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(3, 5));
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

/** Normalize stored/imported period lists; empty → defaults. */
export function normalizePeriodSlots(
  slots: PeriodSlot[] | null | undefined,
): PeriodSlot[] {
  if (!slots || slots.length === 0) return defaultPeriodSlots();
  return slots.map((slot, i) => ({
    label: slot.label?.trim() || `Slot ${i + 1}`,
    startTime: isValidPeriodTime(slot.startTime) ? slot.startTime : "09:00",
    endTime: isValidPeriodTime(slot.endTime) ? slot.endTime : "10:00",
  }));
}

export function getPeriodSlots(settings: Pick<Settings, "periodSlots">): PeriodSlot[] {
  return normalizePeriodSlots(settings.periodSlots);
}

/**
 * Resolve 0-based slotIndex to start/end times.
 * Returns null when index is out of range.
 */
export function resolvePeriodSlot(
  slots: PeriodSlot[] | null | undefined,
  slotIndex: number,
): PeriodSlot | null {
  const list = normalizePeriodSlots(slots);
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= list.length
  ) {
    return null;
  }
  return list[slotIndex] ?? null;
}

/** Validate a draft row before saving Settings. */
export function validatePeriodSlot(slot: PeriodSlot): string | null {
  if (!isValidPeriodTime(slot.startTime) || !isValidPeriodTime(slot.endTime)) {
    return "Times must be HH:mm.";
  }
  if (slot.endTime <= slot.startTime) {
    return "End time must be after start.";
  }
  return null;
}

export function validatePeriodSlots(slots: PeriodSlot[]): string | null {
  if (slots.length === 0) return "Add at least one period.";
  if (slots.length > MAX_PERIODS) return "Keep at most 12 periods.";
  for (let i = 0; i < slots.length; i++) {
    const err = validatePeriodSlot(slots[i]!);
    if (err) return `Period ${i + 1}: ${err}`;
  }
  return null;
}

/** Build times for add-class from slotIndex (chat / programmatic). */
export function timesFromSlotIndex(
  settings: Pick<Settings, "periodSlots">,
  slotIndex: number,
): { startTime: string; endTime: string; label: string } | null {
  const slot = resolvePeriodSlot(settings.periodSlots, slotIndex);
  if (!slot) return null;
  return {
    startTime: slot.startTime,
    endTime: slot.endTime,
    label: slot.label,
  };
}

export function periodKey(startTime: string, endTime: string): string {
  return `${startTime}|${endTime}`;
}

/** True when slots still match the stock college defaults (untouched template). */
export function isStockDefaultPeriods(slots: PeriodSlot[]): boolean {
  const defaults = defaultPeriodSlots();
  if (slots.length !== defaults.length) return false;
  return slots.every(
    (s, i) =>
      s.startTime === defaults[i]!.startTime &&
      s.endTime === defaults[i]!.endTime,
  );
}

function uniqueValidTimes(
  times: Array<{ startTime: string; endTime: string }>,
): Array<{ startTime: string; endTime: string }> {
  const seen = new Set<string>();
  const out: Array<{ startTime: string; endTime: string }> = [];
  for (const t of times) {
    if (
      !isValidPeriodTime(t.startTime) ||
      !isValidPeriodTime(t.endTime) ||
      t.endTime <= t.startTime
    ) {
      continue;
    }
    const key = periodKey(t.startTime, t.endTime);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ startTime: t.startTime, endTime: t.endTime });
  }
  out.sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime),
  );
  return out;
}

function labelSlots(slots: Array<{ startTime: string; endTime: string }>): PeriodSlot[] {
  return slots.map((s, i) => ({
    label: `Slot ${i + 1}`,
    startTime: s.startTime,
    endTime: s.endTime,
  }));
}

/** Display / persist label from 0-based index — times are the source of truth. */
export function periodSlotDisplayLabel(index: number): string {
  return `Slot ${index + 1}`;
}

/**
 * Renumber to unique Slot 1…N. Fixes duplicates after merge (e.g. preserved
 * "Slot 4" next to a newly inserted Slot 4).
 */
export function renumberPeriodSlotLabels(slots: PeriodSlot[]): PeriodSlot[] {
  return slots.map((s, i) => ({
    ...s,
    label: periodSlotDisplayLabel(i),
  }));
}

function labelsHaveDuplicates(slots: PeriodSlot[]): boolean {
  const seen = new Set<string>();
  for (const s of slots) {
    const key = (s.label?.trim() || "").toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Ensure Settings period chips cover real class times.
 * - Exact matches keep the current list (renumber if duplicate Slot labels).
 * - Missing times while still on stock defaults → replace defaults with needed times.
 * - Otherwise append missing periods (cap 12), sorted by start, then renumber uniquely.
 */
export function ensurePeriodSlotsCover(
  current: PeriodSlot[] | null | undefined,
  needed: Array<{ startTime: string; endTime: string }>,
): { slots: PeriodSlot[]; changed: boolean } {
  const base = normalizePeriodSlots(current);
  const uniqueNeeded = uniqueValidTimes(needed);
  if (uniqueNeeded.length === 0) {
    if (labelsHaveDuplicates(base)) {
      return { slots: renumberPeriodSlotLabels(base), changed: true };
    }
    return { slots: base, changed: false };
  }

  const missing = uniqueNeeded.filter(
    (t) =>
      !base.some(
        (s) => s.startTime === t.startTime && s.endTime === t.endTime,
      ),
  );
  if (missing.length === 0) {
    if (labelsHaveDuplicates(base)) {
      return { slots: renumberPeriodSlotLabels(base), changed: true };
    }
    return { slots: base, changed: false };
  }

  if (isStockDefaultPeriods(base)) {
    return { slots: labelSlots(uniqueNeeded).slice(0, MAX_PERIODS), changed: true };
  }

  const merged = uniqueValidTimes([
    ...base.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
    ...missing,
  ]).slice(0, MAX_PERIODS);

  // Times are source of truth — always renumber uniquely after insert/sort.
  return {
    slots: renumberPeriodSlotLabels(
      merged.map((t) => ({
        label: "",
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    ),
    changed: true,
  };
}

/**
 * Pre-select a period chip for an existing start/end.
 * Exact → nearest among same start (by end distance).
 * Returns null when nothing matches — never silently picks Slot 1.
 * Callers should sync missing times via ensurePeriodSlotsCover / resolvePeriodChipsForTimes first.
 */
export function matchPeriodSlotIndex(
  slots: PeriodSlot[],
  startTime: string,
  endTime: string,
): number | null {
  if (!slots.length) return null;

  const exact = slots.findIndex(
    (s) => s.startTime === startTime && s.endTime === endTime,
  );
  if (exact >= 0) return exact;

  const endMin = timeToMinutes(endTime);
  let bestIndex: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (slot.startTime !== startTime) continue;
    const e = timeToMinutes(slot.endTime);
    const dist =
      endMin != null && e != null ? Math.abs(e - endMin) : 0;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Load Settings periods, sync missing class times into the template, persist if needed.
 * Returns the chips list + selected index for the given class times.
 */
export async function resolvePeriodChipsForTimes(
  startTime: string,
  endTime: string,
  extraTimes: Array<{ startTime: string; endTime: string }> = [],
): Promise<{ slots: PeriodSlot[]; selectedIndex: number | null }> {
  const { getSettings, saveSettings, listSeries } = await import("@/lib/db");
  const settings = await getSettings();
  const series = await listSeries();
  const needed = [
    { startTime, endTime },
    ...extraTimes,
    ...series.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  ];
  const covered = ensurePeriodSlotsCover(settings.periodSlots, needed);
  let slots = covered.slots;
  let changed = covered.changed;
  if (labelsHaveDuplicates(slots)) {
    slots = renumberPeriodSlotLabels(slots);
    changed = true;
  }
  if (changed) {
    await saveSettings({ periodSlots: slots });
  }
  return {
    slots,
    selectedIndex: matchPeriodSlotIndex(slots, startTime, endTime),
  };
}
