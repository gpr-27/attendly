/**
 * Load today’s sessions + critical standings from Dexie and
 * schedule local notifications according to settings prefs.
 */

import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  type AttendanceMarkStatus,
} from "@/lib/attendance";
import { mapOdPolicy } from "@/lib/today-types";
import {
  criticalFireKey,
  wasNotificationFired,
} from "./fired-store";
import { getNotifyPermission } from "./permission";
import {
  planCriticalAlerts,
  planSessionReminders,
  type CriticalSubject,
  type SchedulableSession,
} from "./plan";
import { registerNotificationServiceWorker } from "./register-sw";
import { scheduleReminders } from "./scheduler";

function todayBounds(now = new Date()) {
  const fromIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).toISOString();
  const toIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).toISOString();
  return { fromIso, toIso };
}

function normalizeSessionStatus(
  status: string,
): "held" | "cancelled" | "holiday" {
  if (status === "cancelled" || status === "holiday") return status;
  return "held";
}

export type SyncNotificationsResult = {
  scheduled: number;
  permission: ReturnType<typeof getNotifyPermission>;
  skippedReason?: string;
};

/**
 * Re-read Dexie + settings and (re)schedule today’s local reminders.
 * Safe to call often; no-ops when disabled or permission not granted.
 */
export async function syncTodayNotifications(
  now = new Date(),
): Promise<SyncNotificationsResult> {
  const permission = getNotifyPermission();
  if (permission === "unsupported") {
    return { scheduled: 0, permission, skippedReason: "unsupported" };
  }

  const { getSettings } = await import("@/lib/db");
  const settings = await getSettings();

  if (!settings.notifyEnabled) {
    const { clearScheduledNotifications } = await import("./scheduler");
    clearScheduledNotifications();
    return { scheduled: 0, permission, skippedReason: "disabled" };
  }

  if (permission !== "granted") {
    return { scheduled: 0, permission, skippedReason: "permission" };
  }

  await registerNotificationServiceWorker();

  const {
    listSessionsInRange,
    listSubjects,
    listAttendance,
    getSession,
  } = await import("@/lib/db");

  const bounds = todayBounds(now);
  const [sessions, subjects, allMarks] = await Promise.all([
    listSessionsInRange(bounds.fromIso, bounds.toIso),
    listSubjects(),
    listAttendance(),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const markBySession = new Map(allMarks.map((m) => [m.sessionId, m]));

  const schedulable: SchedulableSession[] = sessions.map((session) => {
    const subject = subjectById.get(session.subjectId);
    const mark = markBySession.get(session.id);
    const label =
      subject?.shortCode || subject?.name || "Class";
    return {
      id: session.id,
      subjectLabel: label,
      startsAtMs: new Date(session.startsAt).getTime(),
      endsAtMs: new Date(session.endsAt).getTime(),
      needsMark:
        session.status !== "cancelled" &&
        session.status !== "holiday" &&
        !mark,
      status: session.status,
    };
  });

  const prefs = {
    notifyEnabled: settings.notifyEnabled,
    notifyPreClass: settings.notifyPreClass,
    notifyPreClassMinutes: settings.notifyPreClassMinutes,
    notifyPostClass: settings.notifyPostClass,
    notifyCritical: settings.notifyCritical,
  };

  const nowMs = now.getTime();
  const sessionReminders = planSessionReminders(schedulable, prefs, nowMs);

  const criticalSubjects: CriticalSubject[] = [];
  if (prefs.notifyCritical) {
    const od = mapOdPolicy(settings.odCountsAs);
    const { listSessions, listCalendarBlocks } = await import("@/lib/db");
    const { countRemainingClasses } = await import("@/lib/attendance");
    const { todayYmd } = await import("@/lib/dates");
    const [allSessions, blocks] = await Promise.all([
      listSessions(),
      listCalendarBlocks(),
    ]);
    const countableSessions = allSessions.map((s) => ({
      subjectId: String(s.subjectId),
      startsAt: s.startsAt,
      status: s.status,
      countsTowardAttendance: s.countsTowardAttendance,
      sessionType: s.sessionType,
    }));
    const asOf = todayYmd();
    const semesterEnd = settings.semesterEnd?.trim() || undefined;

    const sessionCache = new Map<
      string,
      Awaited<ReturnType<typeof getSession>>
    >();
    async function sessionOf(id: string) {
      if (!sessionCache.has(id)) sessionCache.set(id, await getSession(id));
      return sessionCache.get(id);
    }

    for (const subject of subjects) {
      if (subject.archived) continue;
      const rows: Array<{
        markStatus: AttendanceMarkStatus;
        sessionStatus: string;
        countsTowardAttendance?: boolean;
      }> = [];
      for (const mark of allMarks) {
        const session = await sessionOf(mark.sessionId);
        if (session?.subjectId !== subject.id) continue;
        rows.push({
          markStatus: mark.status,
          sessionStatus: normalizeSessionStatus(session.status),
          countsTowardAttendance: session.countsTowardAttendance,
        });
      }
      const counts = countAttendanceFromMarks(rows, od);
      if (counts.total <= 0) continue;
      const remaining = countRemainingClasses({
        sessions: countableSessions,
        asOfYmd: asOf,
        semesterEnd,
        subjectId: String(subject.id),
        calendarBlocks: blocks,
      });
      const standing = calculateSubjectStanding(
        counts.attended,
        counts.total,
        {
          collegeTargetPct: subject.targetPct ?? settings.targetPct,
          bufferPct: settings.bufferPct,
        },
        remaining,
      );
      const bunksLeft =
        remaining > 0
          ? standing.canSkipThisTerm
          : standing.classesYouCanSkip;
      if (bunksLeft > 1) continue;
      if (wasNotificationFired(criticalFireKey(subject.id, now))) continue;
      criticalSubjects.push({
        subjectId: subject.id,
        label: subject.shortCode || subject.name,
        classesYouCanSkip: bunksLeft,
      });
    }
  }

  const criticalReminders = planCriticalAlerts(
    criticalSubjects,
    prefs,
    nowMs,
  );

  const scheduled = scheduleReminders(
    [...sessionReminders, ...criticalReminders],
    nowMs,
  );

  return { scheduled, permission };
}
