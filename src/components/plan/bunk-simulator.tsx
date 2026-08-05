"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSettings,
  listAttendance,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type ClassSession,
  type Subject,
} from "@/lib/db";
import {
  calculatePercentage,
  calculateSubjectStanding,
  countAttendanceFromMarks,
  nextClassImpact,
  resolveCollegeTargetPct,
  type OdCountsAs,
} from "@/lib/attendance";

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

export function BunkSimulator() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<
    Map<string, { attended: number; total: number }>
  >(new Map());
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(2);
  const [subjectId, setSubjectId] = useState("");
  const [extraSkips, setExtraSkips] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [subs, sessions, marks, settings] = await Promise.all([
        listSubjects(),
        listSessions(),
        listAttendance(),
        getSettings(),
      ]);
      setTargetPct(settings.targetPct);
      setBufferPct(settings.bufferPct);

      const sessionById = new Map<string, ClassSession>();
      for (const s of sessions) sessionById.set(String(s.id), s);

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
      setSubjectId((prev) =>
        prev || (active[0]?.id != null ? String(active[0].id) : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plan data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const subject = subjects.find((s) => String(s.id) === subjectId);
  const base = counts.get(subjectId) ?? { attended: 0, total: 0 };

  const result = useMemo(() => {
    if (!subject) return null;
    const college = resolveCollegeTargetPct({
      settingsTargetPct: targetPct,
      subjectTargetPct: subject.targetPct,
    });
    const standing = calculateSubjectStanding(
      base.attended,
      base.total,
      { collegeTargetPct: college, bufferPct },
      0,
    );
    const skips = Math.max(0, Math.floor(extraSkips));
    const afterPct =
      calculatePercentage(base.attended, base.total + skips) ?? null;
    const impact = nextClassImpact(base.attended, base.total);
    return { standing, afterPct, impact, college };
  }, [subject, base, targetPct, bufferPct, extraSkips]);

  if (loading) {
    return <p className="text-sm text-mute">Loading…</p>;
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised/80 px-5 py-8">
        <p className="font-display text-lg text-ink">Nothing to simulate</p>
        <p className="mt-1 text-sm text-mute">
          Import or add subjects first, then mark some classes — no fake rows.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/timetable"
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white"
          >
            Set up timetable
          </a>
          <a
            href="/import"
            className="rounded-full border border-line bg-mist/50 px-4 py-2 text-xs font-semibold text-ink"
          >
            Import photo
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rise rise-delay-1 grid gap-5 md:grid-cols-2 md:items-start">
      {error ? (
        <p className="rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger md:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
      <label className="block text-xs font-medium text-mute">
        Subject
        <select
          className="mt-1 w-full rounded-2xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={String(s.id)} value={String(s.id)}>
              {s.name}
              {s.shortCode &&
              s.shortCode.toLowerCase() !== s.name.toLowerCase()
                ? ` (${s.shortCode})`
                : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-mute">
        Extra bunks to simulate
        <input
          type="number"
          min={0}
          max={40}
          className="mt-1 w-full rounded-2xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink"
          value={extraSkips}
          onChange={(e) => setExtraSkips(Number(e.target.value))}
        />
      </label>
      </div>

      {result && subject ? (
        <div
          className="rounded-2xl bg-surface-raised p-4 ring-1 ring-line"
          style={{ borderLeft: `4px solid ${subject.color}` }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">
            Now · {base.attended}/{base.total}
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tabular-nums text-ink">
            {result.standing.percentage == null
              ? "—"
              : `${result.standing.percentage.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Risk {result.standing.risk} · can bunk{" "}
            {result.standing.classesYouCanSkip} · recover{" "}
            {result.standing.classesToRecover}
          </p>

          <hr className="my-4 border-line" />

          <p className="text-xs font-semibold uppercase tracking-wide text-mute">
            If you bunk {extraSkips} more
          </p>
          <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink">
            {result.afterPct == null ? "—" : `${result.afterPct.toFixed(1)}%`}
          </p>
          <p className="mt-2 text-sm text-mute">
            Next class: skip → {result.impact.skipPercentage.toFixed(1)}% ·
            attend → {result.impact.attendPercentage.toFixed(1)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}
