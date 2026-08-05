"use client";

import Link from "next/link";
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
import { todayYmd } from "@/lib/dates";
import {
  buildSkipAttendLadder,
  buildSubjectBunkOutlook,
  countAttendanceFromMarks,
  countRemainingClasses,
  formatBunkInsight,
  formatPct,
  listUpcomingCountableSessions,
  nextClassImpact,
  resolveCollegeTargetPct,
  simulateBunkScenario,
  skipsUntilRiskBand,
  type OdCountsAs,
  type RiskBand,
  type SubjectBunkOutlook,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";

type Panel = "overview" | "lab";
type LabMode = "quick" | "sessions" | "recover";

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

const RISK_TONE: Record<RiskBand, string> = {
  Safe: "text-risk-safe",
  Warning: "text-risk-watch",
  Critical: "text-risk-danger",
};

const RISK_BADGE: Record<RiskBand, string> = {
  Safe: "bg-risk-safe-bg text-risk-safe ring-risk-safe/30",
  Warning: "bg-risk-watch-bg text-risk-watch ring-risk-watch/30",
  Critical: "bg-risk-danger-bg text-risk-danger ring-risk-danger/30",
};

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RiskMeter({
  percentage,
  collegeTarget,
  bufferTarget,
}: {
  percentage: number | null;
  collegeTarget: number;
  bufferTarget: number;
}) {
  const pct = percentage ?? 0;
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 overflow-hidden rounded-full bg-mist ring-1 ring-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all"
          style={{ width: `${width}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-risk-watch/80"
          style={{ left: `${collegeTarget}%` }}
          title={`College min ${collegeTarget}%`}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-risk-safe/80"
          style={{ left: `${bufferTarget}%` }}
          title={`Buffer target ${bufferTarget}%`}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[0.65rem] text-mute">
        <span>0%</span>
        <span>Min {collegeTarget}%</span>
        <span>Safe {bufferTarget}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function OutlookTable({
  rows,
  onSelect,
  selectedId,
}: {
  rows: SubjectBunkOutlook[];
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-mist/60 text-xs uppercase tracking-wide text-mute">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Subject</th>
            <th className="px-3 py-2.5 font-semibold">Now</th>
            <th className="px-3 py-2.5 font-semibold">Risk</th>
            <th className="px-3 py-2.5 font-semibold">Left</th>
            <th className="px-3 py-2.5 font-semibold">Can bunk</th>
            <th className="px-3 py-2.5 font-semibold">Forecast</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = row.subjectId === selectedId;
            const s = row.standing;
            return (
              <tr
                key={row.subjectId}
                className={cn(
                  "border-t border-line/70 cursor-pointer transition-colors",
                  active ? "bg-brand/8" : "hover:bg-mist/40",
                )}
                onClick={() => onSelect(row.subjectId)}
              >
                <td className="px-3 py-2.5">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-medium text-ink">{row.name}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink-soft">
                  {s.percentage == null ? "—" : `${s.percentage.toFixed(1)}%`}
                  <span className="ml-1 text-xs text-mute">
                    ({s.attended}/{s.total})
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                      RISK_BADGE[s.risk],
                    )}
                  >
                    {s.risk}
                  </span>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink-soft">
                  {s.remainingClasses}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-semibold text-ink">
                  {s.canSkipThisTerm}
                </td>
                <td className="max-w-[12rem] px-3 py-2.5 text-xs text-mute">
                  {row.bunkInsight}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BunkSimulator() {
  const [panel, setPanel] = useState<Panel>("overview");
  const [labMode, setLabMode] = useState<LabMode>("quick");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [counts, setCounts] = useState<
    Map<string, { attended: number; total: number }>
  >(new Map());
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(2);
  const [semesterEnd, setSemesterEnd] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [extraSkips, setExtraSkips] = useState(1);
  const [extraAttends, setExtraAttends] = useState(1);
  const [pickedSessionIds, setPickedSessionIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const { ensureSessionsMaterialized } = await import("@/lib/timetable");
      try {
        await ensureSessionsMaterialized();
      } catch {
        /* forecast best-effort */
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
      setSemesterEnd(settings.semesterEnd ?? "");
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

  useEffect(() => {
    setPickedSessionIds(new Set());
  }, [subjectId, labMode]);

  const asOf = todayYmd();

  const outlook = useMemo(() => {
    if (subjects.length === 0) return [];
    return buildSubjectBunkOutlook({
      subjects: subjects.map((s) => {
        const base = counts.get(String(s.id)) ?? { attended: 0, total: 0 };
        return {
          id: String(s.id),
          name: s.name,
          shortCode: s.shortCode,
          color: s.color,
          attended: base.attended,
          total: base.total,
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
      asOfYmd: asOf,
      semesterEnd: semesterEnd || undefined,
      calendarBlocks: blocks,
      bufferPct,
    });
  }, [subjects, counts, sessions, asOf, semesterEnd, blocks, targetPct, bufferPct]);

  const subject = subjects.find((s) => String(s.id) === subjectId);
  const base = counts.get(subjectId) ?? { attended: 0, total: 0 };

  const collegeTarget = subject
    ? resolveCollegeTargetPct({
        settingsTargetPct: targetPct,
        subjectTargetPct: subject.targetPct,
      })
    : targetPct;
  const effectiveTarget = collegeTarget + bufferPct;

  const remaining = useMemo(() => {
    if (!subjectId) return 0;
    return countRemainingClasses({
      sessions: sessions.map((s) => ({
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
        sessionType: s.sessionType,
      })),
      asOfYmd: asOf,
      semesterEnd: semesterEnd || undefined,
      subjectId,
      calendarBlocks: blocks,
    });
  }, [sessions, subjectId, asOf, semesterEnd, blocks]);

  const upcomingSessions = useMemo(() => {
    if (!subjectId) return [];
    return listUpcomingCountableSessions({
      sessions: sessions.map((s) => ({
        id: String(s.id),
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
        sessionType: s.sessionType,
        location: s.location,
      })),
      subjectId,
      asOfYmd: asOf,
      semesterEnd: semesterEnd || undefined,
      calendarBlocks: blocks,
      limit: 24,
    });
  }, [sessions, subjectId, asOf, semesterEnd, blocks]);

  const scenarioSkips =
    labMode === "sessions" ? pickedSessionIds.size : Math.max(0, extraSkips);
  const scenarioAttends = labMode === "recover" ? Math.max(0, extraAttends) : 0;

  const currentStanding = useMemo(() => {
    if (!subject) return null;
    return simulateBunkScenario({
      attended: base.attended,
      total: base.total,
      remainingClasses: remaining,
      settings: { collegeTargetPct: collegeTarget, bufferPct },
      extraSkips: 0,
      extraAttends: 0,
    });
  }, [subject, base, remaining, collegeTarget, bufferPct]);

  const scenario = useMemo(() => {
    if (!subject) return null;
    return simulateBunkScenario({
      attended: base.attended,
      total: base.total,
      remainingClasses: remaining,
      settings: { collegeTargetPct: collegeTarget, bufferPct },
      extraSkips: scenarioSkips,
      extraAttends: scenarioAttends,
    });
  }, [
    subject,
    base,
    remaining,
    collegeTarget,
    bufferPct,
    scenarioSkips,
    scenarioAttends,
  ]);

  const ladder = useMemo(() => {
    if (!subject || !scenario) return [];
    return buildSkipAttendLadder({
      attended: scenario.attended,
      total: scenario.total,
      settings: { collegeTargetPct: collegeTarget, bufferPct },
      steps: 8,
    });
  }, [subject, scenario, collegeTarget, bufferPct]);

  const skipsToCritical = useMemo(() => {
    if (!subject) return null;
    return skipsUntilRiskBand({
      attended: base.attended,
      total: base.total,
      settings: { collegeTargetPct: collegeTarget, bufferPct },
      targetBand: "Critical",
    });
  }, [subject, base, collegeTarget, bufferPct]);

  const skipsToWarning = useMemo(() => {
    if (!subject) return null;
    return skipsUntilRiskBand({
      attended: base.attended,
      total: base.total,
      settings: { collegeTargetPct: collegeTarget, bufferPct },
      targetBand: "Warning",
    });
  }, [subject, base, collegeTarget, bufferPct]);

  const nextImpact = nextClassImpact(base.attended, base.total);

  function applyMaxSafe() {
    const max = currentStanding?.standing.canSkipThisTerm ?? 0;
    setExtraSkips(max);
    setLabMode("quick");
  }

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
    <div className="space-y-5">
      {error ? (
        <p className="rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "All subjects"],
            ["lab", "Subject lab"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm font-semibold ring-1 transition",
              panel === id
                ? "bg-brand text-white ring-brand"
                : "bg-surface-raised text-ink-soft ring-line hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {panel === "overview" ? (
        <div className="space-y-3">
          <p className="text-sm text-mute">
            Ranked by safe bunks this term. Tap a row to open it in Subject lab.
          </p>
          <OutlookTable
            rows={outlook}
            selectedId={subjectId}
            onSelect={(id) => {
              setSubjectId(id);
              setPanel("lab");
            }}
          />
        </div>
      ) : null}

      {panel === "lab" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["quick", "Quick bunk"],
                  ["sessions", "Pick classes"],
                  ["recover", "Recovery"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLabMode(id)}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-xs font-semibold ring-1",
                    labMode === id
                      ? "bg-ink text-white ring-ink"
                      : "bg-surface-raised text-ink-soft ring-line",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {labMode === "quick" ? (
              <div className="space-y-3 rounded-2xl bg-mist/40 p-4 ring-1 ring-line">
                <label className="block text-xs font-medium text-mute">
                  Extra bunks to simulate
                  <input
                    type="range"
                    min={0}
                    max={Math.max(remaining, 20)}
                    className="mt-2 w-full accent-brand"
                    value={extraSkips}
                    onChange={(e) => setExtraSkips(Number(e.target.value))}
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className="w-20 rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-sm tabular-nums"
                      value={extraSkips}
                      onChange={(e) =>
                        setExtraSkips(Math.max(0, Number(e.target.value)))
                      }
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExtraSkips((n) => Math.max(0, n - 1))
                        }
                        className="min-h-10 rounded-full bg-surface-raised px-3 py-2 text-xs font-semibold ring-1 ring-line"
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtraSkips((n) => n + 1)}
                        className="min-h-10 rounded-full bg-surface-raised px-3 py-2 text-xs font-semibold ring-1 ring-line"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={applyMaxSafe}
                        className="min-h-10 rounded-full bg-brand/15 px-3 py-2 text-xs font-semibold text-brand ring-1 ring-brand/30"
                      >
                        Max safe ({currentStanding?.standing.canSkipThisTerm ?? 0})
                      </button>
                    </div>
                  </div>
                </label>
                {skipsToCritical != null ? (
                  <p className="text-xs text-mute">
                    {skipsToCritical} consecutive skip
                    {skipsToCritical === 1 ? "" : "s"} hits college min (
                    {collegeTarget}%).
                    {skipsToWarning != null && skipsToWarning > skipsToCritical
                      ? ` ${skipsToWarning} to leave Safe zone (${effectiveTarget}%).`
                      : null}
                  </p>
                ) : (
                  <p className="text-xs text-mute">
                    Already at or below college min — attend to recover.
                  </p>
                )}
              </div>
            ) : null}

            {labMode === "sessions" ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-mist/40 p-3 ring-1 ring-line">
                <p className="text-xs font-medium text-mute">
                  Pick upcoming classes to miss ({pickedSessionIds.size}{" "}
                  selected)
                </p>
                {upcomingSessions.length === 0 ? (
                  <p className="text-sm text-mute">
                    No upcoming countable sessions — check timetable / semester
                    end.
                  </p>
                ) : (
                  upcomingSessions.map((row) => {
                    const checked = pickedSessionIds.has(row.sessionId);
                    return (
                      <label
                        key={row.sessionId}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-xl px-2 py-2 ring-1 transition",
                          checked
                            ? "bg-brand/10 ring-brand/40"
                            : "bg-surface-raised ring-line hover:ring-brand/25",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 accent-brand"
                          checked={checked}
                          onChange={() => {
                            setPickedSessionIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.sessionId)) {
                                next.delete(row.sessionId);
                              } else {
                                next.add(row.sessionId);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm text-ink">
                          <span className="font-medium">{row.date}</span>
                          {" · "}
                          {formatSessionTime(row.startsAt)}
                          {row.location ? ` · ${row.location}` : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : null}

            {labMode === "recover" ? (
              <div className="space-y-3 rounded-2xl bg-mist/40 p-4 ring-1 ring-line">
                <p className="text-xs text-mute">
                  Simulate attending extra classes (e.g. if you mark present on
                  past absences or upcoming ones).
                </p>
                <label className="block text-xs font-medium text-mute">
                  Extra attends
                  <input
                    type="number"
                    min={0}
                    max={40}
                    className="mt-1 w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm"
                    value={extraAttends}
                    onChange={(e) =>
                      setExtraAttends(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
              </div>
            ) : null}

            <p className="text-xs text-mute">
              Multi-day travel?{" "}
              <Link href="/plan/safe-week" className="font-medium text-brand">
                Safe-week planner →
              </Link>
            </p>
          </div>

          {scenario && subject && currentStanding ? (
            <div
              className="space-y-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line"
              style={{ borderLeft: `4px solid ${subject.color}` }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                    Now · {base.attended}/{base.total}
                  </p>
                  <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                    {currentStanding.percentage == null
                      ? "—"
                      : `${currentStanding.percentage.toFixed(1)}%`}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-medium",
                      RISK_TONE[currentStanding.risk],
                    )}
                  >
                    {currentStanding.risk} ·{" "}
                    {formatBunkInsight(currentStanding.standing)}
                  </p>
                  <div className="mt-3">
                    <RiskMeter
                      percentage={currentStanding.percentage}
                      collegeTarget={collegeTarget}
                      bufferTarget={effectiveTarget}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                    {labMode === "recover"
                      ? `If you attend ${scenarioAttends} more`
                      : scenarioSkips > 0
                        ? `If you bunk ${scenarioSkips} more`
                        : "Scenario (no change)"}
                  </p>
                  <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                    {scenario.percentage == null
                      ? "—"
                      : `${scenario.percentage.toFixed(1)}%`}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-medium",
                      RISK_TONE[scenario.risk],
                    )}
                  >
                    {scenario.risk}
                    {scenario.dropsBelowCollegeMin
                      ? " · below college min"
                      : scenario.dropsBelowBuffer
                        ? " · below buffer"
                        : ""}
                  </p>
                  <p className="mt-2 text-xs text-mute">
                    Can still bunk {scenario.canStillSkip} · recover{" "}
                    {scenario.mustAttend} · {scenario.remainingAfterScenario}{" "}
                    classes left
                  </p>
                </div>
              </div>

              <hr className="border-line" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-mist/50 px-3 py-2.5">
                  <p className="text-[0.65rem] font-semibold uppercase text-mute">
                    Semester if attend all left
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums text-ink">
                    {scenario.semesterIfAttendAllRemaining == null
                      ? "—"
                      : formatPct(scenario.semesterIfAttendAllRemaining)}
                  </p>
                  <p className={cn("text-xs", RISK_TONE[scenario.semesterRiskIfAttendAll])}>
                    {scenario.semesterRiskIfAttendAll}
                  </p>
                </div>
                <div className="rounded-xl bg-mist/50 px-3 py-2.5">
                  <p className="text-[0.65rem] font-semibold uppercase text-mute">
                    Semester if bunk all left
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums text-ink">
                    {scenario.semesterIfSkipAllRemaining == null
                      ? "—"
                      : formatPct(scenario.semesterIfSkipAllRemaining)}
                  </p>
                  <p className={cn("text-xs", RISK_TONE[scenario.semesterRiskIfSkipAll])}>
                    {scenario.semesterRiskIfSkipAll}
                  </p>
                </div>
              </div>

              <p className="text-sm text-mute">
                Next class: skip → {formatPct(nextImpact.skipPercentage)} ·
                attend → {formatPct(nextImpact.attendPercentage)}
              </p>

              <details className="rounded-xl bg-mist/40 px-3 py-2 ring-1 ring-line">
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  Next {ladder.length} classes — skip vs attend ladder
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-left text-xs">
                    <thead className="text-mute">
                      <tr>
                        <th className="pb-2 pr-2">#</th>
                        <th className="pb-2 pr-2">Skip all</th>
                        <th className="pb-2 pr-2">Attend all</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladder.map((row) => (
                        <tr key={row.step} className="border-t border-line/60">
                          <td className="py-1.5 pr-2 tabular-nums">{row.step}</td>
                          <td
                            className={cn(
                              "py-1.5 pr-2 tabular-nums",
                              RISK_TONE[row.skipRisk],
                            )}
                          >
                            {formatPct(row.skipPct)}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 tabular-nums",
                              RISK_TONE[row.attendRisk],
                            )}
                          >
                            {formatPct(row.attendPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
