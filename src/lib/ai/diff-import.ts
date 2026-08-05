import type { ParsedSlot, ParseTimetableResult } from "./schemas";
import type { ImportApplyMode } from "./schemas";
import type { Subject, TimetableSeries } from "@/lib/db/types";

export type ExistingSlotRef = {
  seriesId: string;
  subjectId: string;
  shortCode: string;
  dayOfWeek: number;
  start: string;
  end: string;
  location?: string;
};

export type SlotDiffOp =
  | { op: "add"; slot: ParsedSlot }
  | {
      op: "update";
      seriesId: string;
      slot: ParsedSlot;
      patch: { location?: string };
    }
  | { op: "keep"; seriesId: string; slot: ParsedSlot };

export type SlotDiffPlan = {
  mode: ImportApplyMode;
  ops: SlotDiffOp[];
  /** Series ids to remove when mode is replace (subjects in import). */
  removeSeriesIds: string[];
  summary: {
    add: number;
    update: number;
    keep: number;
    remove: number;
  };
};

/** Normalize room + faculty into a single location string for Dexie. */
export function formatSlotLocation(slot: {
  location?: string;
  faculty?: string;
}): string | undefined {
  const room = slot.location?.trim();
  const faculty = slot.faculty?.trim();
  if (room && faculty) return `${room} · ${faculty}`;
  return room || faculty || undefined;
}

export function slotKey(parts: {
  shortCode: string;
  dayOfWeek: number;
  start: string;
  end: string;
}): string {
  return [
    parts.shortCode.trim().toUpperCase(),
    parts.dayOfWeek,
    parts.start,
    parts.end,
  ].join("|");
}

export function buildExistingSlotRefs(
  series: TimetableSeries[],
  subjects: Subject[],
): ExistingSlotRef[] {
  const byId = new Map(subjects.map((s) => [String(s.id), s]));
  const out: ExistingSlotRef[] = [];
  for (const s of series) {
    const sub = byId.get(String(s.subjectId));
    if (!sub) continue;
    out.push({
      seriesId: String(s.id),
      subjectId: String(s.subjectId),
      shortCode: sub.shortCode,
      dayOfWeek: s.dayOfWeek,
      start: s.startTime,
      end: s.endTime,
      location: s.location,
    });
  }
  return out;
}

/**
 * Diff incoming parse vs existing Dexie series.
 * - diff: add new / update location-only changes / keep matches; never delete
 * - replace: remove series for subjects present in the import, then add all incoming
 */
export function planSlotDiff(options: {
  mode: ImportApplyMode;
  parsed: ParseTimetableResult;
  existing: ExistingSlotRef[];
}): SlotDiffPlan {
  const { mode, parsed, existing } = options;
  const importCodes = new Set(
    parsed.subjects.map((s) => s.shortCode.trim().toUpperCase()),
  );

  if (mode === "replace") {
    const removeSeriesIds = existing
      .filter((e) => importCodes.has(e.shortCode.trim().toUpperCase()))
      .map((e) => e.seriesId);

    const ops: SlotDiffOp[] = parsed.slots.map((slot) => ({
      op: "add" as const,
      slot,
    }));

    return {
      mode,
      ops,
      removeSeriesIds,
      summary: {
        add: ops.length,
        update: 0,
        keep: 0,
        remove: removeSeriesIds.length,
      },
    };
  }

  const existingByKey = new Map(
    existing.map((e) => [
      slotKey({
        shortCode: e.shortCode,
        dayOfWeek: e.dayOfWeek,
        start: e.start,
        end: e.end,
      }),
      e,
    ]),
  );

  const ops: SlotDiffOp[] = [];
  for (const slot of parsed.slots) {
    const key = slotKey({
      shortCode: slot.subjectShortCode,
      dayOfWeek: slot.dayOfWeek,
      start: slot.start,
      end: slot.end,
    });
    const match = existingByKey.get(key);
    if (!match) {
      ops.push({ op: "add", slot });
      continue;
    }
    const nextLoc = formatSlotLocation(slot);
    const prevLoc = match.location?.trim() || undefined;
    if ((nextLoc || undefined) !== (prevLoc || undefined) && nextLoc) {
      ops.push({
        op: "update",
        seriesId: match.seriesId,
        slot,
        patch: { location: nextLoc },
      });
    } else {
      ops.push({ op: "keep", seriesId: match.seriesId, slot });
    }
  }

  return {
    mode: "diff",
    ops,
    removeSeriesIds: [],
    summary: {
      add: ops.filter((o) => o.op === "add").length,
      update: ops.filter((o) => o.op === "update").length,
      keep: ops.filter((o) => o.op === "keep").length,
      remove: 0,
    },
  };
}
