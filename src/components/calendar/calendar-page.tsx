"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  listAttendance,
  listCalendarBlocks,
  listSessions,
  type AttendanceRecord,
  type CalendarBlock,
  type ClassSession,
} from "@/lib/db";
import { MonthGrid } from "@/components/calendar/month-grid";
import { DayAgenda } from "@/components/today/day-agenda";
import { parseYmd, todayYmd } from "@/lib/dates";

export type DayStatus =
  | "none"
  | "present"
  | "absent"
  | "mixed"
  | "cancelled"
  | "holiday"
  | "on_duty";

function initialDateFromUrl(): string {
  if (typeof window === "undefined") return todayYmd();
  const params = new URLSearchParams(window.location.search);
  return parseYmd(params.get("date")) ?? todayYmd();
}

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [marks, setMarks] = useState<AttendanceRecord[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ymd = initialDateFromUrl();
    setSelectedYmd(ymd);
    const [y, m] = ymd.split("-").map(Number);
    setCursor(startOfMonth(new Date(y, m - 1, 1)));
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [s, m, b] = await Promise.all([
        listSessions(),
        listAttendance(),
        listCalendarBlocks(),
      ]);
      setSessions(s);
      setMarks(m);
      setBlocks(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function selectDay(ymd: string) {
    setSelectedYmd(ymd);
    const [y, m] = ymd.split("-").map(Number);
    setCursor(startOfMonth(new Date(y, m - 1, 1)));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("date", ymd);
      window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
    }
  }

  const statusByDay = useMemo(() => {
    const map = new Map<string, DayStatus>();
    const markBySession = new Map<string, AttendanceRecord>();
    for (const m of marks) markBySession.set(String(m.sessionId), m);

    for (const block of blocks) {
      const start =
        "startsOn" in block &&
        typeof (block as { startsOn?: string }).startsOn === "string"
          ? (block as { startsOn: string }).startsOn
          : (block as { startDate?: string }).startDate;
      const end =
        "endsOn" in block &&
        typeof (block as { endsOn?: string }).endsOn === "string"
          ? (block as { endsOn: string }).endsOn
          : (block as { endDate?: string }).endDate;
      if (!start || !end) continue;
      if (
        block.kind === "holiday" ||
        (block as { suppressesTeaching?: boolean }).suppressesTeaching
      ) {
        const days = eachDayOfInterval({
          start: new Date(start + "T12:00:00"),
          end: new Date(end + "T12:00:00"),
        });
        for (const d of days) {
          map.set(format(d, "yyyy-MM-dd"), "holiday");
        }
      }
    }

    const byDate = new Map<string, ClassSession[]>();
    for (const session of sessions) {
      const date = format(new Date(session.startsAt), "yyyy-MM-dd");
      const list = byDate.get(date) ?? [];
      list.push(session);
      byDate.set(date, list);
    }

    for (const [date, daySessions] of byDate) {
      if (map.get(date) === "holiday") continue;
      const statuses = daySessions.map((s) => {
        if (s.status === "cancelled" || s.status === "holiday")
          return "cancelled";
        const mark = markBySession.get(String(s.id));
        if (!mark) return "none";
        if (mark.status === "on_duty" || mark.status === "excused")
          return "on_duty";
        if (mark.status === "absent") return "absent";
        if (mark.status === "present" || mark.status === "late")
          return "present";
        return "none";
      });

      const meaningful = statuses.filter((s) => s !== "none");
      if (meaningful.length === 0) {
        if (statuses.includes("cancelled")) map.set(date, "cancelled");
        continue;
      }
      const set = new Set(meaningful);
      if (set.size === 1) {
        map.set(date, meaningful[0]!);
      } else {
        map.set(date, "mixed");
      }
    }

    return map;
  }, [sessions, marks, blocks]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
            Month scan
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Calendar
          </h1>
          <p className="mt-1.5 text-sm text-mute">
            Tap a day for classes and marks — empty until you mark.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="min-h-10 min-w-10 rounded-full text-ink-soft ring-1 ring-line"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            className="min-h-10 min-w-10 rounded-full text-ink-soft ring-1 ring-line"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </header>

      <p className="rise rise-delay-1 mb-3 font-display text-lg text-ink">
        {format(cursor, "MMMM yyyy")}
      </p>

      {error ? (
        <p className="mb-3 rounded-[var(--radius)] bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : (
        <MonthGrid
          days={days}
          cursor={cursor}
          selectedYmd={selectedYmd}
          statusByDay={statusByDay}
          isSameMonth={isSameMonth}
          onSelectDay={selectDay}
        />
      )}

      <ul className="mt-5 flex flex-wrap gap-3 text-[0.7rem] text-mute">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-risk-safe" /> Present
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-risk-danger" /> Absent
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-risk-watch" /> Mixed / OD
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-mute" /> Cancelled / holiday
        </li>
      </ul>

      <div className="mt-8 border-t border-line pt-6">
        <DayAgenda
          ymd={selectedYmd}
          onYmdChange={selectDay}
          showNavigator
          onChanged={() => void reload()}
        />
      </div>
    </main>
  );
}
