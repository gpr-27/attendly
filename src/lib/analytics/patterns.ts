/**
 * Streaks & weekday absence patterns from real Dexie sessions + marks.
 * No invented attendance — empty inputs yield empty insights.
 */

import type { AttendanceRecord, AttendanceStatus, ClassSession } from "@/lib/db/types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayInsight = {
  dayOfWeek: number;
  dayName: string;
  absences: number;
  presents: number;
  marked: number;
  absenceRate: number;
};

export type PatternCard = {
  id: string;
  tone: "watch" | "safe" | "neutral";
  title: string;
  detail: string;
};

export type StreakStats = {
  /** Consecutive calendar days (ending today or yesterday) with ≥1 present and 0 absents. */
  currentPresentStreak: number;
  longestPresentStreak: number;
  /** Consecutive days ending today where every counted session was marked. */
  currentMarkStreak: number;
  daysWithMarks: number;
  totalAbsences: number;
  totalPresents: number;
};

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localDateKey(dt.toISOString());
}

function todayKey(): string {
  return localDateKey(new Date().toISOString());
}

function isPresentish(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
}

function isAbsence(status: AttendanceStatus): boolean {
  return status === "absent";
}

type DayBucket = {
  presents: number;
  absences: number;
  other: number;
  marked: number;
};

function buildDayBuckets(
  sessions: ClassSession[],
  marks: AttendanceRecord[],
): Map<string, DayBucket> {
  const markBySession = new Map(marks.map((m) => [m.sessionId, m]));
  const buckets = new Map<string, DayBucket>();

  for (const session of sessions) {
    if (session.status === "cancelled" || session.status === "holiday") continue;
    if (!session.countsTowardAttendance) continue;
    const mark = markBySession.get(session.id);
    if (!mark) continue;

    const key = localDateKey(session.startsAt);
    const bucket = buckets.get(key) ?? {
      presents: 0,
      absences: 0,
      other: 0,
      marked: 0,
    };
    bucket.marked += 1;
    if (isPresentish(mark.status)) bucket.presents += 1;
    else if (isAbsence(mark.status)) bucket.absences += 1;
    else bucket.other += 1;
    buckets.set(key, bucket);
  }

  return buckets;
}

function streakLength(
  buckets: Map<string, DayBucket>,
  startKey: string,
  predicate: (b: DayBucket) => boolean,
): number {
  let key = startKey;
  let n = 0;
  // Walk back at most ~2 years of calendar days
  for (let i = 0; i < 800; i++) {
    const bucket = buckets.get(key);
    if (!bucket || !predicate(bucket)) break;
    n += 1;
    key = addDaysKey(key, -1);
  }
  return n;
}

function longestStreak(
  buckets: Map<string, DayBucket>,
  predicate: (b: DayBucket) => boolean,
): number {
  const keys = [...buckets.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of keys) {
    const bucket = buckets.get(key)!;
    if (!predicate(bucket)) {
      run = 0;
      prev = key;
      continue;
    }
    if (prev && addDaysKey(prev, 1) === key) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

export function computeStreaks(
  sessions: ClassSession[],
  marks: AttendanceRecord[],
): StreakStats {
  const buckets = buildDayBuckets(sessions, marks);
  const presentClean = (b: DayBucket) => b.presents > 0 && b.absences === 0;
  const fullyMarked = (b: DayBucket) => b.marked > 0; // days that have marks

  const today = todayKey();
  let currentPresent = streakLength(buckets, today, presentClean);
  if (currentPresent === 0) {
    currentPresent = streakLength(buckets, addDaysKey(today, -1), presentClean);
  }

  let currentMark = streakLength(buckets, today, fullyMarked);
  if (currentMark === 0) {
    currentMark = streakLength(buckets, addDaysKey(today, -1), fullyMarked);
  }

  let totalAbsences = 0;
  let totalPresents = 0;
  for (const b of buckets.values()) {
    totalAbsences += b.absences;
    totalPresents += b.presents;
  }

  return {
    currentPresentStreak: currentPresent,
    longestPresentStreak: longestStreak(buckets, presentClean),
    currentMarkStreak: currentMark,
    daysWithMarks: buckets.size,
    totalAbsences,
    totalPresents,
  };
}

export function computeWeekdayInsights(
  sessions: ClassSession[],
  marks: AttendanceRecord[],
): DayInsight[] {
  const markBySession = new Map(marks.map((m) => [m.sessionId, m]));
  const byDow: Array<{ absences: number; presents: number; marked: number }> =
    Array.from({ length: 7 }, () => ({
      absences: 0,
      presents: 0,
      marked: 0,
    }));

  for (const session of sessions) {
    if (session.status === "cancelled" || session.status === "holiday") continue;
    if (!session.countsTowardAttendance) continue;
    const mark = markBySession.get(session.id);
    if (!mark) continue;
    const dow = new Date(session.startsAt).getDay();
    byDow[dow].marked += 1;
    if (isPresentish(mark.status)) byDow[dow].presents += 1;
    else if (isAbsence(mark.status)) byDow[dow].absences += 1;
  }

  return byDow.map((row, dayOfWeek) => ({
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    absences: row.absences,
    presents: row.presents,
    marked: row.marked,
    absenceRate: row.marked > 0 ? row.absences / row.marked : 0,
  }));
}

/** Pattern cards only when there is enough real signal. */
export function buildPatternCards(insights: DayInsight[]): PatternCard[] {
  const withMarks = insights.filter((d) => d.marked >= 2);
  if (withMarks.length === 0) return [];

  const cards: PatternCard[] = [];
  const totalAbs = insights.reduce((s, d) => s + d.absences, 0);
  const totalMarked = insights.reduce((s, d) => s + d.marked, 0);

  if (totalMarked < 4) {
    return [
      {
        id: "need-more",
        tone: "neutral",
        title: "Not enough marks yet",
        detail:
          "Pattern cards appear after a few weeks of real Present/Absent marks.",
      },
    ];
  }

  const worst = [...withMarks].sort(
    (a, b) => b.absenceRate - a.absenceRate || b.absences - a.absences,
  )[0];

  const avgRate =
    withMarks.reduce((s, d) => s + d.absenceRate, 0) / withMarks.length;

  if (
    worst &&
    worst.absences >= 2 &&
    worst.absenceRate >= avgRate + 0.12 &&
    worst.absenceRate >= 0.25
  ) {
    cards.push({
      id: `miss-${worst.dayOfWeek}`,
      tone: "watch",
      title: `You miss ${worst.dayName}s more often`,
      detail: `${worst.absences} absent of ${worst.marked} marked ${worst.dayName} classes (${Math.round(worst.absenceRate * 100)}%). Watch that day.`,
    });
  }

  const best = [...withMarks]
    .filter((d) => d.marked >= 3)
    .sort((a, b) => a.absenceRate - b.absenceRate || b.presents - a.presents)[0];

  if (best && best.absenceRate <= 0.1 && best.presents >= 3) {
    cards.push({
      id: `strong-${best.dayOfWeek}`,
      tone: "safe",
      title: `${best.dayName}s look solid`,
      detail: `${best.presents} present of ${best.marked} marked — your strongest weekday so far.`,
    });
  }

  if (totalAbs === 0 && totalMarked >= 5) {
    cards.push({
      id: "zero-abs",
      tone: "safe",
      title: "No absences recorded",
      detail: `${totalMarked} counted marks, zero absents — keep the streak honest.`,
    });
  } else if (cards.length === 0 && totalAbs > 0) {
    cards.push({
      id: "spread",
      tone: "neutral",
      title: "Absences are spread out",
      detail: `${totalAbs} absent across ${totalMarked} marked classes — no single weekday stands out yet.`,
    });
  }

  return cards;
}
