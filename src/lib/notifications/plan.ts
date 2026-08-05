/**
 * Pure helpers that decide *what* to schedule from today’s sessions
 * and critical standings. No browser APIs — easy to unit-test.
 */

import type { PreClassLeadMinutes } from "@/lib/db/types";

export type SchedulableSession = {
  id: string;
  subjectLabel: string;
  startsAtMs: number;
  endsAtMs: number;
  /** Cancelled / holiday / already marked → skip post-class nudge. */
  needsMark: boolean;
  status: "scheduled" | "cancelled" | "holiday" | "completed" | string;
};

export type NotifyPlanPrefs = {
  notifyEnabled: boolean;
  notifyPreClass: boolean;
  notifyPreClassMinutes: PreClassLeadMinutes;
  notifyPostClass: boolean;
  notifyCritical: boolean;
};

export type PlannedReminder =
  | {
      kind: "pre";
      sessionId: string;
      fireAtMs: number;
      leadMinutes: number;
      title: string;
      body: string;
      tag: string;
    }
  | {
      kind: "post";
      sessionId: string;
      fireAtMs: number;
      title: string;
      body: string;
      tag: string;
    }
  | {
      kind: "critical";
      subjectId: string;
      /** Fire ASAP (0 delay) when app is open. */
      fireAtMs: number;
      title: string;
      body: string;
      tag: string;
    };

export type CriticalSubject = {
  subjectId: string;
  label: string;
  classesYouCanSkip: number;
};

const MAX_SCHEDULE_MS = 24 * 60 * 60 * 1000;

/**
 * Build pre/post reminders for sessions still ahead (or ending soon).
 * Skips cancelled/holiday. Only schedules fires in (now, now+24h].
 */
export function planSessionReminders(
  sessions: SchedulableSession[],
  prefs: NotifyPlanPrefs,
  nowMs: number,
): PlannedReminder[] {
  if (!prefs.notifyEnabled) return [];

  const out: PlannedReminder[] = [];

  for (const session of sessions) {
    if (session.status === "cancelled" || session.status === "holiday") {
      continue;
    }

    if (prefs.notifyPreClass) {
      const lead = prefs.notifyPreClassMinutes;
      const fireAtMs = session.startsAtMs - lead * 60_000;
      if (fireAtMs > nowMs && fireAtMs - nowMs <= MAX_SCHEDULE_MS) {
        out.push({
          kind: "pre",
          sessionId: session.id,
          fireAtMs,
          leadMinutes: lead,
          title: "Class starting soon",
          body: `${session.subjectLabel} in ${lead} min`,
          tag: `attendly-pre-${session.id}`,
        });
      }
    }

    if (prefs.notifyPostClass && session.needsMark) {
      const fireAtMs = session.endsAtMs;
      if (fireAtMs > nowMs && fireAtMs - nowMs <= MAX_SCHEDULE_MS) {
        out.push({
          kind: "post",
          sessionId: session.id,
          fireAtMs,
          title: "Mark attendance",
          body: `${session.subjectLabel} ended — tap to mark Present / Absent`,
          tag: `attendly-post-${session.id}`,
        });
      }
    }
  }

  return out;
}

/** Critical alerts for subjects with bunk buffer ≤ 1 (and at least one counted class). */
export function planCriticalAlerts(
  subjects: CriticalSubject[],
  prefs: NotifyPlanPrefs,
  nowMs: number,
): PlannedReminder[] {
  if (!prefs.notifyEnabled || !prefs.notifyCritical) return [];

  return subjects
    .filter((s) => s.classesYouCanSkip <= 1)
    .map((s) => ({
      kind: "critical" as const,
      subjectId: s.subjectId,
      fireAtMs: nowMs,
      title: "Critical subject",
      body:
        s.classesYouCanSkip <= 0
          ? `${s.label}: no bunks left — protect the next class`
          : `${s.label}: only 1 bunk left — be careful`,
      tag: `attendly-critical-${s.subjectId}`,
    }));
}
