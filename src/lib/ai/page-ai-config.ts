import type { CoachMode } from "@/lib/ai/schemas";

export type PageAiKey =
  | "today"
  | "timetable"
  | "subjects"
  | "calendar"
  | "import"
  | "insights"
  | "plan"
  | "settings"
  | "analytics"
  | "onboarding";

export type PageAiConfig = {
  key: PageAiKey;
  /** Hint sent to POST /api/ai/coach as pageContext. */
  pageContext: string;
  title: string;
  starters: string[];
  defaultMode?: CoachMode;
  /**
   * Full Agent Control (chat + walkthroughs + Dexie actions).
   * Only Today / Coach / Analytics.
   */
  agentControl: boolean;
  /**
   * Subject/class tap → local insight popup only (no chat).
   */
  insightPopup: boolean;
  /** @deprecated — no per-tab FAB. Always false. */
  shellFab: boolean;
  /** @deprecated — no inline chat cards. Always false. */
  inlineCard: boolean;
  tipOnly?: boolean;
};

const CONFIGS: Record<PageAiKey, PageAiConfig> = {
  today: {
    key: "today",
    pageContext:
      "User is on Today. Default to grounded chat about today sessions, %, bunks, and risk. Only emit structured Dexie actions when they clearly ask to change data (mark, cancel, move, holiday, add subject/class).",
    title: "Agent Control",
    starters: [
      "Can I bunk anything this week?",
      "How am I doing?",
      "Add subject",
      "Set holiday tomorrow",
    ],
    agentControl: true,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  timetable: {
    key: "timetable",
    pageContext: "User is on Timetable.",
    title: "Timetable",
    starters: [],
    agentControl: false,
    insightPopup: true,
    shellFab: false,
    inlineCard: false,
  },
  subjects: {
    key: "subjects",
    pageContext: "User is on Subjects.",
    title: "Subjects",
    starters: [],
    agentControl: false,
    insightPopup: true,
    shellFab: false,
    inlineCard: false,
  },
  calendar: {
    key: "calendar",
    pageContext: "User is on Calendar.",
    title: "Calendar",
    starters: [],
    agentControl: false,
    insightPopup: true,
    shellFab: false,
    inlineCard: false,
  },
  import: {
    key: "import",
    pageContext: "User is on Import.",
    title: "Import",
    starters: [],
    agentControl: false,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  insights: {
    key: "insights",
    pageContext:
      "User is on Coach. Prefer conversational Q&A grounded in stats. Guided Dexie actions only when they tap chips or clearly ask to mutate data. Never invent %.",
    title: "Agent Control",
    starters: [
      "What can you do?",
      "Can I bunk anything this week?",
      "Add subject",
      "Build a protect-this-week plan",
    ],
    defaultMode: "chat",
    agentControl: true,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  plan: {
    key: "plan",
    pageContext: "User is on Plan.",
    title: "Plan",
    starters: [],
    agentControl: false,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  settings: {
    key: "settings",
    pageContext: "User is on Settings.",
    title: "Settings",
    starters: [],
    agentControl: false,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  analytics: {
    key: "analytics",
    pageContext:
      "User is on Analytics. Interpret streaks and standing from stats in chat. Guided Agent actions only when they clearly ask to change data.",
    title: "Agent Control",
    starters: [
      "What do my streaks say?",
      "Can I bunk anything this week?",
      "Add subject",
    ],
    agentControl: true,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
  },
  onboarding: {
    key: "onboarding",
    pageContext: "User is onboarding.",
    title: "Quick tip",
    starters: [],
    agentControl: false,
    insightPopup: false,
    shellFab: false,
    inlineCard: false,
    tipOnly: true,
  },
};

/** Resolve page AI config from Next.js pathname. */
export function getPageAiConfig(pathname: string): PageAiConfig | null {
  if (pathname.startsWith("/onboarding")) return CONFIGS.onboarding;
  if (pathname.startsWith("/timetable")) return CONFIGS.timetable;
  if (pathname.startsWith("/subjects")) return CONFIGS.subjects;
  if (pathname.startsWith("/calendar")) return CONFIGS.calendar;
  if (pathname.startsWith("/import")) return CONFIGS.import;
  if (pathname.startsWith("/insights")) return CONFIGS.insights;
  if (pathname.startsWith("/plan")) return CONFIGS.plan;
  if (pathname.startsWith("/settings")) return CONFIGS.settings;
  if (pathname.startsWith("/analytics")) return CONFIGS.analytics;
  if (pathname === "/") return CONFIGS.today;
  return null;
}

export function getPageAiByKey(key: PageAiKey): PageAiConfig {
  return CONFIGS[key];
}
