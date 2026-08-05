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
  formatBunkInsight,
  projectAllSubjects,
  resolveCollegeTargetPct,
  type OdCountsAs,
  type SubjectProjectionRow,
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

/**
 * Semester-end projection per subject — remaining classes skip exam/holiday
 * blackouts from calendarBlocks.
 */
export function SemesterProjectionPanel() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [counts, setCounts] = useState<
    Map<string, { attended: number; total: number }>
  >(new Map());
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(0);
  const [semesterEnd, setSemesterEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const { ensureSessionsMaterialized } = await import("@/lib/timetable");
      try {
        await ensureSessionsMaterialized();
      } catch {
        /* Rem forecast best-effort */
      }

      const [subs, sess, marks, settings, cal] = await Promise.all([
        listSubjects(),
        listSessions(),
        listAttendance(),
        getSettings(),
        listCalendarBlocks(),
      ]);
      setTargetPct(settings.targetPct);
      setBufferPct(settings.bufferPct);
      setSemesterEnd(settings.semesterEnd);
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
      setError(e instanceof Error ? e.message : "Could not load projection");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows: SubjectProjectionRow[] = useMemo(() => {
    return projectAllSubjects({
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
      sessions: sessions.map((s) => ({
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
        sessionType: s.sessionType,
      })),
      asOfYmd: todayYmd(),
      semesterEnd: semesterEnd || undefined,
      calendarBlocks: blocks,
      bufferPct,
    });
  }, [subjects, sessions, blocks, counts, targetPct, bufferPct, semesterEnd]);

  if (loading) {
    return <p className="text-sm text-mute">Loading…</p>;
  }

  if (subjects.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-mute">
        Add subjects and generate sessions to see semester-end projections.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}
      {!semesterEnd ? (
        <p className="text-xs text-mute">
          Tip: set semester end in onboarding so remaining classes are bounded.
        </p>
      ) : null}
      {rows.every((r) => r.projection.remaining === 0) ? (
        <p className="rounded-2xl border border-dashed border-line px-3 py-2 text-xs text-mute">
          Add timetable / check semester end dates to unlock bunk forecast
        </p>
      ) : null}
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const p = row.projection;
          return (
            <li
              key={row.subjectId}
              className="rounded-2xl bg-surface-raised p-4 ring-1 ring-line"
              style={{ borderLeft: `4px solid ${row.color}` }}
            >
              <p className="text-sm font-semibold text-ink">
                {row.name}{" "}
                {row.shortCode &&
                row.shortCode.toLowerCase() !== row.name.toLowerCase() ? (
                  <span className="font-normal text-mute">{row.shortCode}</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-mute">
                Now {p.attended}/{p.total}
                {p.standing.percentage == null
                  ? ""
                  : ` · ${p.standing.percentage.toFixed(1)}%`}{" "}
                · {p.remaining} left
                {blocks.some((b) => b.suppressesTeaching)
                  ? " (blackouts excluded)"
                  : ""}
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatBunkInsight(p.standing)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-mute">Attend all</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {p.ifAttendAllPct == null
                      ? "—"
                      : `${p.ifAttendAllPct.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-mute">Skip all</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {p.ifSkipAllPct == null
                      ? "—"
                      : `${p.ifSkipAllPct.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-mute">Safe bunks</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {p.safeToSkip}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-mute">Must attend</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {p.mustAttend == null ? "unreachable" : p.mustAttend}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
