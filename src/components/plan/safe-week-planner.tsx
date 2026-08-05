"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSettings,
  listAttendance,
  listCalendarBlocks,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type CalendarBlock,
  type ClassSession,
  type Subject,
} from "@/lib/db";
import {
  countAttendanceFromMarks,
  resolveCollegeTargetPct,
  safeWeekImpact,
  sessionsInDateRange,
  type OdCountsAs,
  type SafeWeekImpact,
} from "@/lib/attendance";

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const RISK_TONE = {
  Safe: "text-risk-safe",
  Warning: "text-risk-watch",
  Critical: "text-risk-danger",
} as const;

/**
 * Pick a travel / festival / placement range and see per-subject impact
 * if every class in that window is missed.
 */
export function SafeWeekPlanner() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [counts, setCounts] = useState<
    Map<string, { attended: number; total: number }>
  >(new Map());
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(0);
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState(todayYmd);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [subs, sess, marks, settings, cal] = await Promise.all([
        listSubjects(),
        listSessions(),
        listAttendance(),
        getSettings(),
        listCalendarBlocks(),
      ]);
      setTargetPct(settings.targetPct);
      setBufferPct(settings.bufferPct);
      setBlocks(cal);
      setSessions(sess);

      const sessionById = new Map<string, ClassSession>();
      for (const s of sess) sessionById.set(String(s.id), s);

      const marksBySubject = new Map<
        string,
        Array<{
          markStatus: AttendanceRecord["status"];
          sessionStatus?: string;
          countsTowardAttendance?: boolean;
        }>
      >();
      for (const mark of marks) {
        const session = sessionById.get(String(mark.sessionId));
        if (!session) continue;
        const sid = String(session.subjectId);
        const list = marksBySubject.get(sid) ?? [];
        list.push({
          markStatus: mark.status,
          sessionStatus: session.status,
          countsTowardAttendance: session.countsTowardAttendance,
        });
        marksBySubject.set(sid, list);
      }

      const od = mapOd(settings.odCountsAs as string | undefined);
      const map = new Map<string, { attended: number; total: number }>();
      const active = subs.filter((s) => !s.archived);
      for (const s of active) {
        const sid = String(s.id);
        map.set(sid, countAttendanceFromMarks(marksBySubject.get(sid) ?? [], od));
      }
      setSubjects(active);
      setCounts(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load safe-week data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const impact: SafeWeekImpact[] = useMemo(() => {
    if (!from || !to || to < from) return [];
    const inRange = sessionsInDateRange(
      sessions.map((s) => ({
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
      })),
      from,
      to,
      blocks,
    );
    return safeWeekImpact({
      subjects: subjects.map((s) => {
        const c = counts.get(String(s.id)) ?? { attended: 0, total: 0 };
        return {
          id: String(s.id),
          shortCode: s.shortCode,
          name: s.name,
          color: s.color,
          attended: c.attended,
          total: c.total,
          collegeTargetPct: resolveCollegeTargetPct({
            settingsTargetPct: targetPct,
            subjectTargetPct: s.targetPct,
          }),
        };
      }),
      sessionsInRange: inRange,
      bufferPct,
    });
  }, [subjects, sessions, blocks, counts, from, to, targetPct, bufferPct]);

  if (loading) {
    return <p className="text-sm text-mute">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-mute">
          From
          <input
            type="date"
            className="mt-1 w-full rounded-2xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-mute">
          To
          <input
            type="date"
            className="mt-1 w-full rounded-2xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised/80 px-5 py-8">
          <p className="font-display text-lg text-ink">Nothing to plan</p>
          <p className="mt-1 text-sm text-mute">
            Add subjects and materialize a timetable first — no fake rows.
          </p>
        </div>
      ) : to < from ? (
        <p className="text-sm text-risk-danger">End date must be on or after start.</p>
      ) : impact.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-mute">
          No countable classes in this range (or they fall on exam/holiday
          blackouts). Pick festival / travel / placement dates that hit your
          timetable.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {impact.map((row) => (
            <li
              key={row.subjectId}
              className="rounded-2xl bg-surface-raised p-4 ring-1 ring-line"
              style={{ borderLeft: `4px solid ${row.color}` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {row.name}{" "}
                  {row.shortCode &&
                  row.shortCode.toLowerCase() !== row.name.toLowerCase() ? (
                    <span className="font-normal text-mute">{row.shortCode}</span>
                  ) : null}
                </p>
                <p className={`text-xs font-semibold ${RISK_TONE[row.riskAfter]}`}>
                  {row.riskAfter}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                Miss {row.missedClasses} class
                {row.missedClasses === 1 ? "" : "es"} →{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {row.afterMissPct == null
                    ? "—"
                    : `${row.afterMissPct.toFixed(1)}%`}
                </span>
                {row.currentPct != null ? (
                  <span className="text-mute">
                    {" "}
                    (now {row.currentPct.toFixed(1)}%
                    {row.pctDrop != null
                      ? ` · −${row.pctDrop.toFixed(1)} pts`
                      : ""}
                    )
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-mute">
                After miss, can still bunk {row.canStillSkip} at{" "}
                {row.effectiveTargetPct}% target
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
