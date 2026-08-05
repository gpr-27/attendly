import type { RiskBand } from "@/lib/attendance";
import type { RiskLevel } from "@/lib/today-types";

/** Focus payload when the user picks a subject or agenda session for the coach. */
export type AiFocusSubject = {
  kind: "subject";
  subjectId: string;
  shortCode: string;
  name: string;
  percentage: number | null;
  risk: RiskBand;
  canBunk: number;
  recover: number;
  attended: number;
  total: number;
};

export type AiFocusSession = {
  kind: "session";
  sessionId: string;
  shortCode: string;
  name: string;
  percentage: number | null;
  risk: RiskLevel | null;
  impactLine?: string | null;
  startLabel: string;
  endLabel: string;
  ymd?: string;
  /** Optional bunk/recovery when known from standing. */
  canBunk?: number;
  recover?: number;
  subjectId?: string;
};

export type AiFocus = AiFocusSubject | AiFocusSession;

export type InsightCardTone = "safe" | "watch" | "danger" | "neutral";

export type InsightCard = {
  id: string;
  label: string;
  value: string;
  tone: InsightCardTone;
};

function riskTone(risk: string | null | undefined): InsightCardTone {
  if (risk === "Critical" || risk === "danger") return "danger";
  if (risk === "Warning" || risk === "watch") return "watch";
  if (risk === "Safe" || risk === "safe") return "safe";
  return "neutral";
}

function riskLabel(risk: string | null | undefined): string {
  if (risk === "danger") return "Critical";
  if (risk === "watch") return "Warning";
  if (risk === "safe") return "Safe";
  return risk ?? "Unknown";
}

/** Instant local insight cards — no API. Shown as soon as focus is set. */
export function buildInsightCards(focus: AiFocus): InsightCard[] {
  const pct =
    focus.percentage == null ? "No marks" : `${focus.percentage.toFixed(1)}%`;

  if (focus.kind === "subject") {
    const skipNext =
      focus.total === 0
        ? "Mark first"
        : focus.canBunk > 0
          ? "Yes — buffer left"
          : focus.recover > 0
            ? "No — recover first"
            : "Borderline — attend";

    const pattern =
      focus.total === 0
        ? "No pattern yet"
        : focus.recover > 0
          ? `Attend next ${focus.recover}`
          : focus.canBunk > 0
            ? `${focus.canBunk} bunk${focus.canBunk === 1 ? "" : "s"} left`
            : "Holding target";

    return [
      {
        id: "bunks",
        label: "Bunks left",
        value:
          focus.total === 0
            ? "—"
            : focus.canBunk > 0
              ? String(focus.canBunk)
              : "0",
        tone: (focus.canBunk > 0
          ? "safe"
          : focus.total === 0
            ? "neutral"
            : "watch") as InsightCardTone,
      },
      {
        id: "risk",
        label: "Risk",
        value: focus.risk,
        tone: riskTone(focus.risk),
      },
      {
        id: "skip",
        label: "Skip next?",
        value: skipNext,
        tone: (focus.canBunk > 0
          ? "safe"
          : focus.recover > 0
            ? "danger"
            : "watch") as InsightCardTone,
      },
      {
        id: "pattern",
        label: "Pattern",
        value: pattern,
        tone: riskTone(focus.risk),
      },
      {
        id: "pct",
        label: "Standing",
        value: pct,
        tone: riskTone(focus.risk),
      },
    ].slice(0, 4);
  }

  const canBunk = focus.canBunk ?? null;
  const recover = focus.recover ?? null;
  const skipNext =
    canBunk != null && canBunk > 0
      ? "Maybe — bunk buffer"
      : recover != null && recover > 0
        ? "No — need recovery"
        : focus.risk === "danger"
          ? "Attend — critical"
          : focus.risk === "safe"
            ? "Flexible if buffer"
            : "Check impact";

  return [
    {
      id: "slot",
      label: "This class",
      value: `${focus.startLabel}–${focus.endLabel}`,
      tone: "neutral",
    },
    {
      id: "risk",
      label: "Risk",
      value: riskLabel(focus.risk),
      tone: riskTone(focus.risk),
    },
    {
      id: "skip",
      label: "Attend?",
      value: skipNext,
      tone: (focus.risk === "danger"
        ? "danger"
        : canBunk != null && canBunk > 0
          ? "safe"
          : "watch") as InsightCardTone,
    },
    {
      id: "impact",
      label: "Impact",
      value: focus.impactLine?.trim() || pct,
      tone: riskTone(focus.risk),
    },
  ];
}

/** Extra pageContext lines for POST /api/ai/coach. */
export function buildFocusPageContext(focus: AiFocus): string {
  if (focus.kind === "subject") {
    return [
      `Selected subjectId=${focus.subjectId} shortCode=${focus.shortCode} (${focus.name}).`,
      `Standing: ${focus.percentage ?? "null"}% · risk=${focus.risk} · attended=${focus.attended}/${focus.total}.`,
      `Bunks left (canBunk)=${focus.canBunk} · recovery classes=${focus.recover}.`,
      "Answer about this subject only using stats. Never invent numbers.",
    ].join(" ");
  }

  return [
    `Selected sessionId=${focus.sessionId} shortCode=${focus.shortCode} (${focus.name}).`,
    `Slot ${focus.startLabel}–${focus.endLabel}${focus.ymd ? ` on ${focus.ymd}` : ""}.`,
    `Standing: ${focus.percentage ?? "null"}% · risk=${focus.risk ?? "unknown"}.`,
    focus.impactLine ? `Impact: ${focus.impactLine}.` : "",
    focus.canBunk != null ? `canBunk=${focus.canBunk}.` : "",
    focus.recover != null ? `recover=${focus.recover}.` : "",
    'User asked "Should I attend this?" — one clear recommendation from stats only.',
  ]
    .filter(Boolean)
    .join(" ");
}

/** Auto-sent coach prompt when focus opens the panel. */
export function buildAutoInsightPrompt(focus: AiFocus): string {
  if (focus.kind === "subject") {
    return `Subject digest for ${focus.shortCode}: summarize %, bunks left, recovery, risk, and whether I can skip the next class. Use only stats.`;
  }
  return `Should I attend ${focus.shortCode} (${focus.startLabel}–${focus.endLabel})? One clear yes/no/lean recommendation from stats (%, risk, bunk buffer).`;
}

/** Stable key so auto-insight re-runs when the same subject is re-clicked. */
export function focusKey(focus: AiFocus): string {
  if (focus.kind === "subject") return `subject:${focus.subjectId}`;
  return `session:${focus.sessionId}`;
}

/** One-line tip for the focused insight panel (local, no API). */
export function buildInsightTip(focus: AiFocus): string {
  if (focus.kind === "subject") {
    if (focus.total === 0) {
      return "Mark a few classes to unlock bunk math for this subject.";
    }
    if (focus.canBunk > 0) {
      return `You can skip up to ${focus.canBunk} more and still hold target.`;
    }
    if (focus.recover > 0) {
      return `Attend the next ${focus.recover} class${focus.recover === 1 ? "" : "es"} to recover.`;
    }
    return "You're at the edge of target — attend the next class.";
  }

  if (focus.risk === "danger") {
    return "This class is critical — attend if you can.";
  }
  if (focus.canBunk != null && focus.canBunk > 0) {
    return "You still have bunk buffer on this subject — skipping once is usually fine.";
  }
  if (focus.recover != null && focus.recover > 0) {
    return "Recovery mode — prioritize attending this slot.";
  }
  return focus.impactLine?.trim() || "Check standing before you skip.";
}
