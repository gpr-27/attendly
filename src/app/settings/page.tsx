"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PreClassLeadMinutes, ThemeMode } from "@/lib/db/types";
import {
  getNotifyPermission,
  notificationSupported,
  requestNotifyPermission,
  syncTodayNotifications,
  type NotifyPermission,
} from "@/lib/notifications";
import { refreshThemeFromSettings } from "@/components/shell/app-providers";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { CalendarBlocksEditor } from "@/components/settings/calendar-blocks-editor";
import { DailyPeriodsEditor } from "@/components/settings/daily-periods-editor";
import { ScheduleBackupPanel } from "@/components/settings/schedule-backup-panel";
import { SemesterRangeEditor } from "@/components/settings/semester-range-editor";
import { AttendanceReportButton } from "@/components/analytics/print-report";
import type { DayOfWeek } from "@/lib/db/types";

/** Settings — criteria, a11y, notifications, PDF, schedule backup. */
export default function SettingsPage() {
  const [targetPct, setTargetPct] = useState<number | null>(null);
  const [bufferPct, setBufferPct] = useState<number | null>(null);
  const [semesterName, setSemesterName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("system");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [largeTapTargets, setLargeTapTargets] = useState(false);
  const [a11yBusy, setA11yBusy] = useState(false);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPreClass, setNotifyPreClass] = useState(true);
  const [notifyPreClassMinutes, setNotifyPreClassMinutes] =
    useState<PreClassLeadMinutes>(15);
  const [notifyPostClass, setNotifyPostClass] = useState(true);
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [permission, setPermission] = useState<NotifyPermission>("default");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    (async () => {
      const { getSettings } = await import("@/lib/db");
      const settings = await getSettings();
      setTargetPct(settings.targetPct);
      setBufferPct(settings.bufferPct);
      setSemesterName(settings.semesterName);
      setTheme(settings.theme);
      setHighContrast(settings.highContrast);
      setReducedMotion(settings.reducedMotion);
      setLargeTapTargets(settings.largeTapTargets);
      setWorkingDays(settings.workingDays);
      setNotifyEnabled(settings.notifyEnabled);
      setNotifyPreClass(settings.notifyPreClass);
      setNotifyPreClassMinutes(settings.notifyPreClassMinutes);
      setNotifyPostClass(settings.notifyPostClass);
      setNotifyCritical(settings.notifyCritical);
      setPermission(getNotifyPermission());
    })().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load settings");
    });
  }, []);

  async function persistA11y(
    patch: Partial<{
      theme: ThemeMode;
      highContrast: boolean;
      reducedMotion: boolean;
      largeTapTargets: boolean;
    }>,
  ) {
    setA11yBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { saveSettings, getSettings } = await import("@/lib/db");
      await saveSettings(patch);
      const settings = await getSettings();
      setTheme(settings.theme);
      setHighContrast(settings.highContrast);
      setReducedMotion(settings.reducedMotion);
      setLargeTapTargets(settings.largeTapTargets);
      await refreshThemeFromSettings();
      setMessage("Display preferences saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save display prefs",
      );
    } finally {
      setA11yBusy(false);
    }
  }

  async function persistNotify(
    patch: Partial<{
      notifyEnabled: boolean;
      notifyPreClass: boolean;
      notifyPreClassMinutes: PreClassLeadMinutes;
      notifyPostClass: boolean;
      notifyCritical: boolean;
    }>,
  ) {
    setNotifyBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { saveSettings, getSettings } = await import("@/lib/db");
      await saveSettings(patch);
      const settings = await getSettings();
      setNotifyEnabled(settings.notifyEnabled);
      setNotifyPreClass(settings.notifyPreClass);
      setNotifyPreClassMinutes(settings.notifyPreClassMinutes);
      setNotifyPostClass(settings.notifyPostClass);
      setNotifyCritical(settings.notifyCritical);
      await syncTodayNotifications();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save notification prefs",
      );
    } finally {
      setNotifyBusy(false);
    }
  }

  async function enableNotifications() {
    setNotifyBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!notificationSupported()) {
        setPermission("unsupported");
        setError("Notifications are not supported in this browser.");
        return;
      }
      const result = await requestNotifyPermission();
      setPermission(result);
      if (result !== "granted") {
        await persistNotify({ notifyEnabled: false });
        setMessage(
          result === "denied"
            ? "Permission denied — enable notifications in browser settings if you change your mind."
            : "Permission not granted yet.",
        );
        return;
      }
      await persistNotify({ notifyEnabled: true });
      setMessage(
        "Notifications enabled. Reminders schedule from today’s classes.",
      );
    } finally {
      setNotifyBusy(false);
    }
  }

  async function disableNotifications() {
    await persistNotify({ notifyEnabled: false });
    setMessage("Notifications turned off.");
  }

  const permissionLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Blocked by browser"
        : permission === "unsupported"
          ? "Not supported"
          : "Not asked yet";

  return (
    <main className="w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
          Attendly
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-mute">
          Local data only — clearing site data can wipe marks.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rise rise-delay-1 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-1">
          <h2 className="font-display text-lg font-semibold text-ink">
            Criteria
          </h2>
          {targetPct === null ? (
            <p className="mt-2 text-sm text-mute">Loading…</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-mute">College minimum</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {targetPct}%
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-mute">Buffer</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  +{bufferPct ?? 0}%
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-mute">Semester</dt>
                <dd className="max-w-[60%] truncate text-right font-semibold text-ink">
                  {semesterName.trim() || "—"}
                </dd>
              </div>
            </dl>
          )}
          <Link
            href="/onboarding"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            Change criteria
          </Link>
        </section>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            Summary PDF
          </h2>
          <p className="mt-1 text-sm text-mute">
            One-click full attendance summary — subjects, %, present/absent,
            risk, bunks, semester range. Choose Save as PDF in the print dialog.
          </p>
          <div className="mt-3">
            <AttendanceReportButton
              label="Download attendance PDF"
              variant="primary"
            />
          </div>
        </section>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">More</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/analytics"
                className="font-medium text-brand hover:underline"
              >
                Analytics & streaks
              </Link>
            </li>
            <li>
              <Link
                href="/calendar"
                className="font-medium text-brand hover:underline"
              >
                Month calendar
              </Link>
            </li>
            <li>
              <Link
                href="/import"
                className="font-medium text-brand hover:underline"
              >
                Import timetable
              </Link>
            </li>
            <li>
              <Link
                href="/plan"
                className="font-medium text-brand hover:underline"
              >
                Bunk planner
              </Link>
            </li>
            <li>
              <Link
                href="/?action=mark-next"
                className="font-medium text-brand hover:underline"
              >
                Deep link: mark next class
              </Link>
            </li>
          </ul>
        </section>

        <ScheduleBackupPanel />

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Display & accessibility
          </h2>
          <p className="mt-1 text-sm text-mute">
            Saved on this device. Larger taps bump mark buttons; reduced motion
            turns off rise animations.
          </p>

          <div className="mt-4">
            <ThemeToggle
              key={theme}
              variant="full"
              onChanged={(value) => setTheme(value)}
            />
          </div>

          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">High contrast</span>
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={highContrast}
                disabled={a11yBusy}
                onChange={(e) =>
                  void persistA11y({ highContrast: e.target.checked })
                }
              />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">Reduced motion</span>
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={reducedMotion}
                disabled={a11yBusy}
                onChange={(e) =>
                  void persistA11y({ reducedMotion: e.target.checked })
                }
              />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">Larger tap targets</span>
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={largeTapTargets}
                disabled={a11yBusy}
                onChange={(e) =>
                  void persistA11y({ largeTapTargets: e.target.checked })
                }
              />
            </li>
          </ul>
        </section>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Working days
          </h2>
          <p className="mt-1 text-sm text-mute">
            Days the materializer creates sessions for (Mon–Sat typical).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                [0, "Sun"],
                [1, "Mon"],
                [2, "Tue"],
                [3, "Wed"],
                [4, "Thu"],
                [5, "Fri"],
                [6, "Sat"],
              ] as const
            ).map(([day, label]) => {
              const on = workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${
                    on
                      ? "bg-brand text-white"
                      : "border border-line bg-mist text-brand-deep"
                  }`}
                  onClick={() => {
                    void (async () => {
                      const next = on
                        ? workingDays.filter((d) => d !== day)
                        : [...workingDays, day].sort(
                            (a, b) => a - b,
                          ) as DayOfWeek[];
                      if (next.length === 0) return;
                      setWorkingDays(next);
                      const { saveSettings } = await import("@/lib/db");
                      await saveSettings({ workingDays: next });
                      setMessage("Working days saved.");
                    })();
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="md:col-span-2">
          <SemesterRangeEditor />
        </div>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Daily periods
          </h2>
          <p className="mt-1 mb-3 text-sm text-mute">
            Fixed college slots (e.g. Slot 1 = 09:00–10:00). Set once — Timetable
            quick-add picks a chip instead of typing start/end every class.
          </p>
          <DailyPeriodsEditor />
        </section>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Exam weeks & holidays
          </h2>
          <p className="mt-1 mb-3 text-sm text-mute">
            Suppresses teaching on those dates when rematerializing.
          </p>
          <CalendarBlocksEditor />
        </section>

        <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-mute">
            Local reminders only — no push server. Keep Attendly open or
            installed as a PWA so timers can fire.
          </p>
          <p className="mt-2 text-xs text-mute">
            Browser permission:{" "}
            <span className="font-medium text-ink">{permissionLabel}</span>
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {notifyEnabled && permission === "granted" ? (
              <button
                type="button"
                disabled={notifyBusy}
                onClick={() => void disableNotifications()}
                className="rounded-xl border border-line bg-mist py-3 text-sm font-semibold text-brand-deep disabled:opacity-60 sm:flex-1"
              >
                Turn off
              </button>
            ) : (
              <button
                type="button"
                disabled={notifyBusy || permission === "unsupported"}
                onClick={() => void enableNotifications()}
                className="rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60 sm:flex-1"
              >
                Enable notifications
              </button>
            )}
          </div>

          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">Pre-class reminder</span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={notifyPreClass}
                disabled={notifyBusy}
                onChange={(e) =>
                  void persistNotify({ notifyPreClass: e.target.checked })
                }
              />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-ink">Remind me</span>
              <div className="flex gap-2">
                {([15, 5] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={notifyBusy || !notifyPreClass}
                    onClick={() =>
                      void persistNotify({ notifyPreClassMinutes: mins })
                    }
                    className={`min-h-10 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                      notifyPreClassMinutes === mins
                        ? "bg-brand text-white"
                        : "border border-line bg-mist text-brand-deep"
                    }`}
                  >
                    T−{mins}
                  </button>
                ))}
              </div>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">Post-class mark nudge</span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={notifyPostClass}
                disabled={notifyBusy}
                onChange={(e) =>
                  void persistNotify({ notifyPostClass: e.target.checked })
                }
              />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">
                Critical alert (bunk buffer ≤ 1)
              </span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={notifyCritical}
                disabled={notifyBusy}
                onChange={(e) =>
                  void persistNotify({ notifyCritical: e.target.checked })
                }
              />
            </li>
          </ul>
        </section>
      </div>

      {message ? (
        <p className="mt-5 text-sm text-risk-safe" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 text-sm text-risk-danger" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
