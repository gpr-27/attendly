"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import {
  addSeries,
  addSubject,
  listSubjects,
} from "@/lib/db";
import { colorForIndex } from "@/lib/db/subject-palette";
import type { ParseTimetableResult, ParsedSlot, ParsedSubject } from "@/lib/ai/schemas";
import { mondayOfWeekYmd, todayYmd } from "@/lib/dates";
import { applySemesterRange } from "@/lib/timetable";
import {
  confidenceLabel,
  highlightClass,
  slotPreviewMeta,
  subjectPreviewMeta,
} from "@/lib/import/preview-confidence";
import { cn } from "@/lib/utils/cn";

type PreviewEditorProps = {
  initial: ParseTimetableResult;
  onClear: () => void;
  onSaved: (summary?: string) => void;
};

function levelFor(
  highlights: ReturnType<typeof subjectPreviewMeta>["highlights"],
  field: string,
) {
  return highlights.find((h) => h.field === field)?.level ?? "ok";
}

function fallbackSemesterBounds() {
  const start = mondayOfWeekYmd(todayYmd());
  const end = format(
    addMonths(new Date(start + "T12:00:00"), 4),
    "yyyy-MM-dd",
  );
  return { start, end };
}

export function PreviewEditor({
  initial,
  onClear,
  onSaved,
}: PreviewEditorProps) {
  const defaults = useMemo(() => fallbackSemesterBounds(), []);
  const [subjects, setSubjects] = useState<ParsedSubject[]>(initial.subjects);
  const [slots, setSlots] = useState<ParsedSlot[]>(initial.slots);
  const [semesterStart, setSemesterStart] = useState(defaults.start);
  const [semesterEnd, setSemesterEnd] = useState(defaults.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { getSettings } = await import("@/lib/db");
      const s = await getSettings();
      const from = s.semesterStart?.trim();
      const to = s.semesterEnd?.trim();
      if (from) setSemesterStart(from);
      if (to && (!from || to >= from)) setSemesterEnd(to);
    })();
  }, []);

  const knownCodes = useMemo(
    () =>
      new Set(
        subjects
          .map((s) => s.shortCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    [subjects],
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const from = semesterStart.trim();
      const to = semesterEnd.trim();
      if (!from || !to) {
        throw new Error("Set semester start and end before saving.");
      }
      if (to < from) {
        throw new Error("Semester end must be on or after start.");
      }

      const existing = await listSubjects();
      const byCode = new Map(
        existing.map((s) => [s.shortCode.toUpperCase(), s]),
      );
      const codeToId = new Map<string, string>();

      let colorIndex = existing.length;
      for (const raw of subjects) {
        const code = raw.shortCode.trim().toUpperCase();
        const found = byCode.get(code);
        if (found?.id != null) {
          codeToId.set(code, String(found.id));
          continue;
        }
        const created = await addSubject({
          name: raw.name.trim(),
          shortCode: raw.shortCode.trim(),
          color: raw.color ?? colorForIndex(colorIndex++),
        });
        codeToId.set(code, String(created.id));
      }

      // Persist semester + align any prior series, then add imported slots
      // with effectiveFrom = semester start (not import day).
      await applySemesterRange({ semesterStart: from, semesterEnd: to });

      for (const slot of slots) {
        const subjectId = codeToId.get(slot.subjectShortCode.trim().toUpperCase());
        if (!subjectId) continue;
        const locationParts = [slot.location?.trim(), slot.faculty?.trim()].filter(
          Boolean,
        );
        await addSeries({
          subjectId,
          dayOfWeek: slot.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          startTime: slot.start,
          endTime: slot.end,
          location: locationParts.length ? locationParts.join(" · ") : undefined,
          sessionType: "lecture",
          effectiveFrom: from,
          effectiveTo: null,
          countsTowardAttendance: true,
        });
      }
      // Sync imported period times into Settings → Daily periods (chip source of truth).
      const { getSettings, saveSettings } = await import("@/lib/db");
      const { ensurePeriodSlotsCover } = await import(
        "@/lib/timetable/period-slots"
      );
      const { materializeSessions } = await import("@/lib/timetable");
      const settings = await getSettings();
      const covered = ensurePeriodSlotsCover(
        settings.periodSlots,
        slots.map((s) => ({ startTime: s.start, endTime: s.end })),
      );
      if (covered.changed) {
        await saveSettings({ periodSlots: covered.slots });
      }
      const result = await materializeSessions({ from, to });
      onSaved(
        `Saved ${subjects.length} subject(s) and ${slots.length} slot(s) · ${result.upserted} class(es) across ${from} → ${to}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">
        Edit anything that looks wrong, then save to Dexie on this device.
        Amber / red rings flag low confidence or missing fields.
      </p>

      <section className="rounded-xl bg-surface-raised p-3 ring-1 ring-line">
        <h2 className="text-sm font-semibold text-ink">Semester range</h2>
        <p className="mt-1 text-xs text-mute">
          Required — the weekly pattern is generated for every day from start
          through end (not from today only).
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-mute">
            Start
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink"
              value={semesterStart}
              onChange={(e) => setSemesterStart(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            End
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink"
              value={semesterEnd}
              onChange={(e) => setSemesterEnd(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-xs text-mute">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-risk-danger-bg ring-1 ring-risk-danger/50" />
          Missing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-risk-watch-bg ring-1 ring-risk-watch/50" />
          Low confidence
        </span>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">Subjects</h2>
        <ul className="mt-2 space-y-2">
          {subjects.map((s, i) => {
            const meta = subjectPreviewMeta(s);
            return (
              <li
                key={`sub-${i}`}
                className="space-y-1 rounded-lg bg-surface-raised p-2 ring-1 ring-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
                    Confidence {confidenceLabel(meta.confidence)} ·{" "}
                    {Math.round(meta.confidence * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-2">
                  <input
                    className={cn(
                      "rounded border border-line bg-surface px-2 py-1.5 text-sm font-semibold",
                      highlightClass(levelFor(meta.highlights, "shortCode")),
                    )}
                    value={s.shortCode}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[i] = { ...s, shortCode: e.target.value };
                      setSubjects(next);
                    }}
                    aria-label="Subject short code"
                  />
                  <input
                    className={cn(
                      "rounded border border-line bg-surface px-2 py-1.5 text-sm",
                      highlightClass(levelFor(meta.highlights, "name")),
                    )}
                    value={s.name}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[i] = { ...s, name: e.target.value };
                      setSubjects(next);
                    }}
                    aria-label="Subject name"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">
          Slots ({slots.length})
        </h2>
        {slots.length === 0 ? (
          <p className="mt-2 text-sm text-mute">No slots detected.</p>
        ) : (
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {slots.map((slot, i) => {
              const meta = slotPreviewMeta(slot, knownCodes);
              const notes = meta.highlights
                .filter((h) => h.level !== "ok" && h.note)
                .map((h) => h.note);
              return (
                <li
                  key={`slot-${i}`}
                  className="space-y-1 rounded-lg bg-surface-raised p-2 text-sm ring-1 ring-line"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
                      {confidenceLabel(meta.confidence)} ·{" "}
                      {Math.round(meta.confidence * 100)}%
                    </span>
                    {notes.length > 0 ? (
                      <span className="text-[0.65rem] text-risk-watch">
                        {notes.join(" · ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={cn(
                        "rounded border border-line bg-surface px-2 py-1.5",
                        highlightClass(
                          levelFor(meta.highlights, "subjectShortCode"),
                        ),
                      )}
                      value={slot.subjectShortCode}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = { ...slot, subjectShortCode: e.target.value };
                        setSlots(next);
                      }}
                      aria-label="Slot subject code"
                    />
                    <select
                      className={cn(
                        "rounded border border-line bg-surface px-2 py-1.5",
                        highlightClass(levelFor(meta.highlights, "dayOfWeek")),
                      )}
                      value={slot.dayOfWeek}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = {
                          ...slot,
                          dayOfWeek: Number(e.target.value),
                        };
                        setSlots(next);
                      }}
                      aria-label="Day of week"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (label, d) => (
                          <option key={label} value={d}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <input
                      type="time"
                      className={cn(
                        "rounded border border-line bg-surface px-2 py-1.5",
                        highlightClass(levelFor(meta.highlights, "start")),
                      )}
                      value={slot.start}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = { ...slot, start: e.target.value };
                        setSlots(next);
                      }}
                      aria-label="Start time"
                    />
                    <input
                      type="time"
                      className={cn(
                        "rounded border border-line bg-surface px-2 py-1.5",
                        highlightClass(levelFor(meta.highlights, "end")),
                      )}
                      value={slot.end}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = { ...slot, end: e.target.value };
                        setSlots(next);
                      }}
                      aria-label="End time"
                    />
                    <input
                      className={cn(
                        "col-span-2 rounded border border-line bg-surface px-2 py-1.5",
                        highlightClass(levelFor(meta.highlights, "location")),
                      )}
                      placeholder="Room (optional)"
                      value={slot.location ?? ""}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = {
                          ...slot,
                          location: e.target.value || undefined,
                        };
                        setSlots(next);
                      }}
                      aria-label="Location"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error ? (
        <p className="rounded-[var(--radius)] bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={
            busy ||
            subjects.length === 0 ||
            !semesterStart.trim() ||
            !semesterEnd.trim()
          }
          onClick={() => void save()}
          className="min-h-11 flex-1 rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Confirm & save"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-full px-4 text-sm font-medium text-mute ring-1 ring-line"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
