import { describe, expect, it } from "vitest";
import {
  planCriticalAlerts,
  planSessionReminders,
  type NotifyPlanPrefs,
  type SchedulableSession,
} from "@/lib/notifications/plan";

const basePrefs: NotifyPlanPrefs = {
  notifyEnabled: true,
  notifyPreClass: true,
  notifyPreClassMinutes: 15,
  notifyPostClass: true,
  notifyCritical: true,
};

describe("planSessionReminders", () => {
  const now = Date.parse("2026-08-05T08:00:00.000Z");

  const session: SchedulableSession = {
    id: "s1",
    subjectLabel: "DSA",
    startsAtMs: Date.parse("2026-08-05T09:00:00.000Z"),
    endsAtMs: Date.parse("2026-08-05T10:00:00.000Z"),
    needsMark: true,
    status: "scheduled",
  };

  it("schedules T−15 pre and post-class when enabled", () => {
    const planned = planSessionReminders([session], basePrefs, now);
    expect(planned).toHaveLength(2);
    expect(planned[0]).toMatchObject({
      kind: "pre",
      leadMinutes: 15,
      fireAtMs: Date.parse("2026-08-05T08:45:00.000Z"),
    });
    expect(planned[1]).toMatchObject({
      kind: "post",
      fireAtMs: session.endsAtMs,
    });
  });

  it("uses T−5 when configured", () => {
    const planned = planSessionReminders(
      [session],
      { ...basePrefs, notifyPreClassMinutes: 5 },
      now,
    );
    const pre = planned.find((p) => p.kind === "pre");
    expect(pre).toMatchObject({
      leadMinutes: 5,
      fireAtMs: Date.parse("2026-08-05T08:55:00.000Z"),
    });
  });

  it("skips when master disabled", () => {
    expect(
      planSessionReminders(
        [session],
        { ...basePrefs, notifyEnabled: false },
        now,
      ),
    ).toEqual([]);
  });

  it("skips cancelled sessions and already-marked post nudges", () => {
    const cancelled = { ...session, status: "cancelled" };
    expect(planSessionReminders([cancelled], basePrefs, now)).toEqual([]);

    const marked = { ...session, needsMark: false };
    const planned = planSessionReminders([marked], basePrefs, now);
    expect(planned.every((p) => p.kind === "pre")).toBe(true);
  });

  it("skips fires that already passed", () => {
    const late = Date.parse("2026-08-05T08:50:00.000Z");
    const planned = planSessionReminders([session], basePrefs, late);
    expect(planned.find((p) => p.kind === "pre")).toBeUndefined();
    expect(planned.find((p) => p.kind === "post")).toBeDefined();
  });
});

describe("planCriticalAlerts", () => {
  const now = Date.parse("2026-08-05T08:00:00.000Z");

  it("alerts when bunk buffer ≤ 1", () => {
    const planned = planCriticalAlerts(
      [
        { subjectId: "a", label: "OS", classesYouCanSkip: 1 },
        { subjectId: "b", label: "Math", classesYouCanSkip: 0 },
        { subjectId: "c", label: "Safe", classesYouCanSkip: 3 },
      ],
      basePrefs,
      now,
    );
    expect(planned).toHaveLength(2);
    expect(planned.map((p) => p.kind)).toEqual(["critical", "critical"]);
    expect(planned[0].body).toContain("only 1 bunk");
    expect(planned[1].body).toContain("no bunks left");
  });

  it("respects notifyCritical off", () => {
    expect(
      planCriticalAlerts(
        [{ subjectId: "a", label: "OS", classesYouCanSkip: 0 }],
        { ...basePrefs, notifyCritical: false },
        now,
      ),
    ).toEqual([]);
  });
});
