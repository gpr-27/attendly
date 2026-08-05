/** Local confidence / missing-field hints for timetable preview editor. */

import type { ParsedSlot, ParsedSubject } from "@/lib/ai/schemas";

export type FieldHighlight = {
  field: string;
  level: "missing" | "low" | "ok";
  note?: string;
};

export type SubjectPreviewMeta = {
  confidence: number;
  highlights: FieldHighlight[];
};

export type SlotPreviewMeta = {
  confidence: number;
  highlights: FieldHighlight[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function subjectPreviewMeta(
  subject: ParsedSubject,
): SubjectPreviewMeta {
  const highlights: FieldHighlight[] = [];
  let score =
    typeof subject.confidence === "number"
      ? clamp01(subject.confidence)
      : 0.85;

  if (!subject.name.trim()) {
    highlights.push({ field: "name", level: "missing", note: "Name required" });
    score -= 0.4;
  } else if (subject.name.trim().length < 2) {
    highlights.push({ field: "name", level: "low", note: "Name looks short" });
    score -= 0.15;
  } else {
    highlights.push({ field: "name", level: "ok" });
  }

  if (!subject.shortCode.trim()) {
    highlights.push({
      field: "shortCode",
      level: "missing",
      note: "Code required",
    });
    score -= 0.4;
  } else if (subject.shortCode.trim().length > 10) {
    highlights.push({
      field: "shortCode",
      level: "low",
      note: "Code is long",
    });
    score -= 0.1;
  } else {
    highlights.push({ field: "shortCode", level: "ok" });
  }

  return { confidence: clamp01(score), highlights };
}

export function slotPreviewMeta(
  slot: ParsedSlot,
  knownCodes: Set<string>,
): SlotPreviewMeta {
  const highlights: FieldHighlight[] = [];
  let score =
    typeof slot.confidence === "number" ? clamp01(slot.confidence) : 0.8;

  const code = slot.subjectShortCode.trim().toUpperCase();
  if (!code) {
    highlights.push({
      field: "subjectShortCode",
      level: "missing",
      note: "Subject code missing",
    });
    score -= 0.45;
  } else if (!knownCodes.has(code)) {
    highlights.push({
      field: "subjectShortCode",
      level: "low",
      note: "Code not in subjects list",
    });
    score -= 0.25;
  } else {
    highlights.push({ field: "subjectShortCode", level: "ok" });
  }

  if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
    highlights.push({ field: "dayOfWeek", level: "missing", note: "Day invalid" });
    score -= 0.4;
  } else {
    highlights.push({ field: "dayOfWeek", level: "ok" });
  }

  if (!/^\d{2}:\d{2}$/.test(slot.start)) {
    highlights.push({ field: "start", level: "missing", note: "Start time" });
    score -= 0.35;
  } else {
    highlights.push({ field: "start", level: "ok" });
  }

  if (!/^\d{2}:\d{2}$/.test(slot.end)) {
    highlights.push({ field: "end", level: "missing", note: "End time" });
    score -= 0.35;
  } else if (
    /^\d{2}:\d{2}$/.test(slot.start) &&
    slot.end <= slot.start
  ) {
    highlights.push({
      field: "end",
      level: "low",
      note: "End before start?",
    });
    score -= 0.2;
  } else {
    highlights.push({ field: "end", level: "ok" });
  }

  if (!slot.location?.trim()) {
    highlights.push({
      field: "location",
      level: "low",
      note: "Room optional / missing",
    });
    score -= 0.05;
  }

  return { confidence: clamp01(score), highlights };
}

export function highlightClass(level: FieldHighlight["level"]): string {
  if (level === "missing") {
    return "ring-2 ring-risk-danger/60 bg-risk-danger-bg/40";
  }
  if (level === "low") {
    return "ring-2 ring-risk-watch/50 bg-risk-watch-bg/50";
  }
  return "";
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}
