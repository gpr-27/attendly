/**
 * Rule-based coach replies from Dexie-backed coach stats.
 * Used when Groq is missing or rate-limited — never invents numbers.
 */

type SubjectRow = {
  shortCode?: string;
  name?: string;
  percentage?: number | null;
  risk?: string;
  canBunk?: number;
  recover?: number;
  remaining?: number;
  bunkInsight?: string;
};

function asSubjects(stats: Record<string, unknown>): SubjectRow[] {
  const raw = stats.subjects;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is SubjectRow => s != null && typeof s === "object");
}

export function looksLikeBunkOrStandingQuestion(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return /\b(can i bunk|what can i bunk|how am i doing|am i safe|explain (my )?risk|attendance (look|status)|this week)\b/.test(
    t,
  );
}

/**
 * Short local bunk / standing digest from coach stats.
 * Returns null when stats are empty / not useful.
 */
export function localBunkAdviceFromStats(
  stats: Record<string, unknown>,
): string | null {
  if (stats.empty === true) {
    return "No attendance marks yet — add subjects / mark a few classes, then ask again. Guided chips still work offline.";
  }

  const subjects = asSubjects(stats);
  if (subjects.length === 0) return null;

  const withSkip = subjects
    .filter((s) => (s.canBunk ?? 0) > 0)
    .sort((a, b) => (b.canBunk ?? 0) - (a.canBunk ?? 0))
    .slice(0, 4);
  const protect = subjects
    .filter(
      (s) =>
        s.risk === "Critical" ||
        s.risk === "Warning" ||
        (s.recover ?? 0) > 0,
    )
    .slice(0, 3);

  const lines: string[] = [
    "Coach is busy / rate-limited — here’s your local bunk math (same rules as Plan / Subjects):",
  ];

  if (withSkip.length > 0) {
    lines.push(
      withSkip
        .map((s) => {
          const label = s.shortCode || s.name || "Subject";
          const pct =
            s.percentage == null ? "—" : `${Math.round(s.percentage)}%`;
          return `• ${label}: can bunk ${s.canBunk} more (${pct}${s.risk ? `, ${s.risk}` : ""})`;
        })
        .join("\n"),
    );
  } else {
    lines.push(
      "• No safe bunks right now — attend remaining classes to stay on target.",
    );
  }

  if (protect.length > 0) {
    lines.push(
      "Protect: " +
        protect
          .map((s) => {
            const label = s.shortCode || s.name || "Subject";
            const recover =
              (s.recover ?? 0) > 0 ? ` · recover ${s.recover}` : "";
            return `${label}${s.risk ? ` (${s.risk})` : ""}${recover}`;
          })
          .join("; "),
    );
  }

  lines.push("Try the coach again in a few minutes for a written digest.");
  return lines.join("\n");
}
