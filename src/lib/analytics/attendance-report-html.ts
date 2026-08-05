/**
 * Printable HTML for the full attendance report (browser print → PDF).
 */

import type {
  AttendanceReport,
  HistoryDay,
  ReportSubjectDetail,
  WeeklyPatternDay,
} from "@/lib/analytics/attendance-report";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pctLabel(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(1)}%`;
}

function bunkLabel(subject: ReportSubjectDetail): string {
  if (subject.total === 0) return "No marks";
  if (subject.bunksLeft > 0) return `Can bunk ${subject.bunksLeft}`;
  if (subject.recovery > 0) return `Attend next ${subject.recovery}`;
  return "On target";
}

function statusLabel(status: string): string {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "on_duty":
      return "OD";
    case "late":
      return "Late";
    case "excused":
      return "Excused";
    case "unmarked":
      return "Unmarked";
    default:
      return status;
  }
}

function renderSubjectsTable(subjects: ReportSubjectDetail[]): string {
  if (subjects.length === 0) {
    return `<tr><td colspan="8">No subjects on this device.</td></tr>`;
  }
  return subjects
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td class="mute">${escapeHtml(s.shortCode)}</td>
        <td>${pctLabel(s.pct)}</td>
        <td>${s.counts.present}</td>
        <td>${s.counts.absent}</td>
        <td>${s.counts.onDuty}</td>
        <td>${escapeHtml(bunkLabel(s))}</td>
        <td>${s.collegeTargetPct}% <span class="mute">(eff. ${s.effectiveTargetPct}%)</span></td>
      </tr>`,
    )
    .join("");
}

function renderWeekly(weekly: WeeklyPatternDay[]): string {
  if (weekly.length === 0) {
    return `<p class="mute">No weekly timetable series yet.</p>`;
  }
  return weekly
    .map((day) => {
      const rows = day.slots
        .map((slot) => {
          const loc = slot.location ? ` · ${escapeHtml(slot.location)}` : "";
          const parity =
            slot.weekParity && slot.weekParity !== "all"
              ? ` · ${escapeHtml(slot.weekParity)} weeks`
              : "";
          return `<li><strong>${escapeHtml(slot.startTime)}–${escapeHtml(slot.endTime)}</strong> ${escapeHtml(slot.name ?? slot.shortCode)} <span class="mute">(${escapeHtml(slot.shortCode)} · ${escapeHtml(slot.sessionType)})</span>${loc}${parity}</li>`;
        })
        .join("");
      return `<h3>${escapeHtml(day.dayName)}</h3><ul>${rows}</ul>`;
    })
    .join("");
}

function renderHistory(history: HistoryDay[]): string {
  if (history.length === 0) {
    return `<p class="mute">No day-by-day history in the semester range yet.</p>`;
  }
  // Cap very long semesters for print readability (still Dexie-real data).
  const MAX_DAYS = 90;
  const slice =
    history.length > MAX_DAYS ? history.slice(history.length - MAX_DAYS) : history;
  const note =
    history.length > MAX_DAYS
      ? `<p class="mute">Showing last ${MAX_DAYS} of ${history.length} days with sessions/marks.</p>`
      : "";

  const blocks = slice
    .map((day) => {
      const items = day.items
        .map(
          (item) =>
            `<li>${escapeHtml(item.time)} · ${escapeHtml(item.name ?? item.shortCode)} · ${escapeHtml(statusLabel(item.status))}</li>`,
        )
        .join("");
      return `<div class="day-block"><h3>${escapeHtml(day.dayLabel)}</h3><ul>${items}</ul></div>`;
    })
    .join("");

  return `${note}<div class="history">${blocks}</div>`;
}

export function renderReportHtml(report: AttendanceReport): string {
  const title = report.semesterName.trim() || "Attendance report";
  const rangeBits = [
    report.semesterStart || null,
    report.semesterEnd || null,
  ].filter(Boolean);
  const rangeLabel =
    rangeBits.length > 0 ? rangeBits.join(" → ") : "Semester dates not set";
  const generated = new Date(report.generatedAt).toLocaleString();
  const o = report.overall;
  const overallBunk =
    o.total === 0
      ? "No marks yet"
      : o.bunksLeft > 0
        ? `Can bunk ${o.bunksLeft}`
        : o.recovery > 0
          ? `Attend next ${o.recovery}`
          : "On target";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — Attendly</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Georgia, "Times New Roman", serif; color: #1a2332; margin: 1.5rem; line-height: 1.45; }
    h1 { font-size: 1.65rem; margin: 0 0 0.2rem; }
    h2 { font-size: 1.15rem; margin: 1.6rem 0 0.55rem; border-bottom: 1px solid #d5dde8; padding-bottom: 0.25rem; }
    h3 { font-size: 0.95rem; margin: 0.85rem 0 0.25rem; }
    p.meta { color: #6b7a8d; font-size: 0.88rem; margin: 0.15rem 0; }
    .mute { color: #6b7a8d; font-size: 0.85rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: 0.75rem; margin: 0.9rem 0 0.4rem; }
    .summary div { background: #f4f7fb; border-radius: 8px; padding: 0.55rem 0.7rem; }
    .summary strong { display: block; font-size: 1.35rem; }
    .summary span { color: #6b7a8d; font-size: 0.78rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; margin-top: 0.4rem; }
    th, td { border-bottom: 1px solid #d5dde8; padding: 0.38rem 0.3rem; text-align: left; vertical-align: top; }
    th { color: #6b7a8d; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
    ul { margin: 0.15rem 0 0.4rem 1.1rem; padding: 0; font-size: 0.88rem; }
    .history { columns: 2; column-gap: 1.5rem; }
    .day-block { break-inside: avoid; margin-bottom: 0.65rem; }
    .footer { margin-top: 2rem; color: #6b7a8d; font-size: 0.78rem; }
    @media print {
      body { margin: 1cm; }
      .summary div { background: none; border: 1px solid #d5dde8; }
      h2 { break-after: avoid; }
      tr, .day-block { break-inside: avoid; }
    }
    @media (max-width: 640px) {
      .history { columns: 1; }
    }
  </style>
</head>
<body>
  <h1>Attendly — ${escapeHtml(title)}</h1>
  <p class="meta">Generated ${escapeHtml(generated)} · On-device Dexie data only</p>
  <p class="meta">${escapeHtml(rangeLabel)} · College target ${report.targetPct}%${report.bufferPct > 0 ? ` (+${report.bufferPct}% buffer)` : ""}</p>

  <h2>Overall standing</h2>
  <div class="summary">
    <div><strong>${pctLabel(o.pct)}</strong><span>Overall</span></div>
    <div><strong>${o.risk}</strong><span>Risk</span></div>
    <div><strong>${o.attended}/${o.total}</strong><span>Attended / Total</span></div>
    <div><strong>${o.counts.present}</strong><span>Present</span></div>
    <div><strong>${o.counts.absent}</strong><span>Absent</span></div>
    <div><strong>${o.counts.onDuty}</strong><span>On duty</span></div>
    <div><strong>${escapeHtml(overallBunk)}</strong><span>Bunk / recovery</span></div>
    <div><strong>${report.streaks.currentPresentStreak}</strong><span>Present streak</span></div>
  </div>

  <h2>Subjects</h2>
  <table>
    <thead>
      <tr>
        <th>Subject</th><th>Code</th><th>%</th><th>P</th><th>A</th><th>OD</th>
        <th>Bunks / recovery</th><th>Target</th>
      </tr>
    </thead>
    <tbody>${renderSubjectsTable(report.subjects)}</tbody>
  </table>

  <h2>Weekly class pattern</h2>
  ${renderWeekly(report.weeklyPattern)}

  <h2>Day-by-day history</h2>
  ${renderHistory(report.history)}

  <p class="footer">Print this page or choose “Save as PDF” in your browser’s print dialog. Figures match marks stored in this browser only.</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 120);
    };
  </script>
</body>
</html>`;
}
