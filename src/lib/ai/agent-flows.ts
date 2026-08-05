/**
 * Local guided walkthroughs for Agent Control (Today / Coach / Analytics).
 * Collects missing fields with chips, then emits AttendlyAction(s).
 */
import { SUBJECT_PALETTE, defaultPeriodSlots } from "@/lib/db";
import { addDaysYmd, todayYmd } from "@/lib/dates";
import type { AttendlyAction, AgentActionsPayload } from "./actions";

export type FlowId =
  | "addSubject"
  | "addWeeklySlot"
  | "deleteSubject"
  | "setHoliday"
  | "idle";

export type AgentFlowState = {
  id: FlowId;
  step: number;
  draft: Record<string, string>;
};

export type FlowStepResult = {
  message: string;
  chips?: string[];
  /** When set, flow finished — execute these. */
  actions?: AttendlyAction[];
  next: AgentFlowState;
  /** true when waiting for confirm on a destructive action */
  needsConfirm?: boolean;
};

const IDLE: AgentFlowState = { id: "idle", step: 0, draft: {} };

/** Suggestion chips that always enter a guided agent walkthrough. */
export const AGENT_ENTRY_CHIPS = [
  "Add subject",
  "Add class",
  "Set holiday",
  "Delete subject",
] as const;

export function idleFlow(): AgentFlowState {
  return IDLE;
}

/**
 * Casual / capability / advice phrasing — must stay in Chat, never start a walkthrough.
 */
export function isChatOnlyMessage(raw: string): boolean {
  const text = raw.trim().toLowerCase().replace(/[!.,]+$/g, "").trim();
  if (!text) return false;

  if (
    /^(hi|hey|hello|yo|sup|hiya|howdy|thanks|thank you|thx|ty|ok|okay|k|cool|nice|great|bye|goodbye|good morning|good evening|good night|gm|gn)$/i.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\bwhat can (u|you|i)\b/.test(text) ||
    /\b(what do you do|how (do|does) (this|you|it) work|your capabilities|help me)\b/.test(
      text,
    ) ||
    text === "help" ||
    text === "capabilities"
  ) {
    return true;
  }

  // Advice / stats Q&A — not mutative
  if (
    /\b(can i bunk|what can i bunk|how am i doing|explain (my )?risk|am i safe|attendance (look|status)|this week)\b/.test(
      text,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Mid-walkthrough: treat as a chat aside (pause guide) instead of a flow answer.
 */
export function looksLikeChatAside(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^(cancel|exit|exit guide|stop guide|stop)$/i.test(t)) return false;
  if (/^(continue|continue setup)$/i.test(t)) return false;
  if (isChatOnlyMessage(t)) return true;
  if (/\?/.test(t)) return true;
  if (
    /\b(what|how|why|explain|should i|can i|am i)\b/i.test(t) &&
    !/\b(add|create|delete|remove|mark|set|cancel|move)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** True when the text is an exact agent-entry chip (case-insensitive). */
export function isAgentEntryChip(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (AGENT_ENTRY_CHIPS as readonly string[]).some(
    (c) => c.toLowerCase() === t,
  );
}

/** Detect a walkthrough intent from free text (no Groq required). */
export function detectFlowIntent(raw: string): AgentFlowState | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // Never hijack casual / capability / advice messages into guides
  if (isChatOnlyMessage(raw)) return null;

  if (
    /\b(add|create|new)\b.*\bsubject\b/.test(text) ||
    text === "add subject" ||
    text.startsWith("add subject ")
  ) {
    const named = /(?:add|create|new)\s+subject\s+(.+)/i.exec(raw.trim());
    const draft: Record<string, string> = {};
    if (named?.[1]) {
      const name = named[1].replace(/^["']|["']$/g, "").trim();
      draft.name = name;
      draft.shortCode = guessShortCode(name);
    }
    return {
      id: "addSubject",
      step: draft.name ? (draft.shortCode ? 2 : 1) : 0,
      draft,
    };
  }

  if (
    /\b(delete|remove)\b.*\bsubject\b/.test(text) ||
    text === "delete subject" ||
    /\b(delete|remove)\s+[a-z][a-z0-9]{1,15}\b/i.test(text)
  ) {
    const code =
      /(?:delete|remove)\s+(?:subject\s+)?([a-z0-9][\w\s-]{0,20})/i.exec(
        raw.trim(),
      )?.[1]?.trim();
    // Avoid "delete subject" alone grabbing "subject" as the code
    const shortCode =
      code && !/^subject$/i.test(code)
        ? code.replace(/\s+/g, "").slice(0, 16)
        : undefined;
    return {
      id: "deleteSubject",
      step: shortCode ? 1 : 0,
      draft: shortCode ? { shortCode } : {},
    };
  }

  if (/\b(add|create)\b.*\b(class|slot|lecture|lab)\b/.test(text)) {
    const draft: Record<string, string> = {};
    const code = /\bfor\s+([a-z0-9]{1,16})\b/i.exec(text)?.[1];
    if (code) draft.shortCode = code.toUpperCase();
    const day = text.match(
      /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thursday|fri|friday|sat|saturday|sun|sunday)\b/,
    )?.[1];
    if (day) {
      const dow = dayNameToDow(day);
      if (dow != null) draft.dayOfWeek = String(dow);
    }
    const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (time) {
      draft.startTime = normalizeTime(time[1]!, time[2], time[3]);
    }
    return { id: "addWeeklySlot", step: 0, draft };
  }

  // Require an action verb — bare "holiday" / "is it a holiday?" stays in chat
  if (
    /\b(set|add|mark)\b.*\bholiday\b/.test(text) ||
    text === "set holiday" ||
    /\bmark\s+.+\s+as\s+holiday\b/.test(text)
  ) {
    const draft: Record<string, string> = {};
    if (/\btomorrow\b/.test(text)) draft.date = addDaysYmd(todayYmd(), 1);
    else if (/\btoday\b/.test(text)) draft.date = todayYmd();
    return { id: "setHoliday", step: draft.date ? 1 : 0, draft };
  }

  // Clear mark-attendance phrasing (sessionId still collected via coach/chips)
  if (
    /\bmark\s+(me\s+)?(present|absent|on[- ]?duty)\b/.test(text) ||
    /\b(cancel|move|reschedule)\s+(class|session|lecture)\b/.test(text)
  ) {
    // No local multi-step for these yet — caller should use Groq agent path
    return null;
  }

  return null;
}

/** Phrases that should open Agent mode + allow Groq Dexie actions (no local flow). */
export function isMutativeAgentRequest(raw: string): boolean {
  if (isChatOnlyMessage(raw)) return false;
  if (detectFlowIntent(raw)) return true;
  if (isAgentEntryChip(raw)) return true;
  const text = raw.trim().toLowerCase();
  return (
    /\bmark\s+(me\s+)?(present|absent|on[- ]?duty)\b/.test(text) ||
    /\b(cancel|move|reschedule)\s+(class|session|lecture|this)\b/.test(text) ||
    /\b(add|create)\b.*\b(extra|makeup)\b/.test(text)
  );
}

function guessShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 8).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 8)
    .toUpperCase();
}

function normalizeTime(
  hRaw: string,
  mRaw?: string,
  ampm?: string,
): string {
  let h = Number(hRaw);
  const m = mRaw ? Number(mRaw) : 0;
  const ap = ampm?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h <= 7) h += 12; // college-ish: "2" → 14:00
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addHour(start: string): string {
  const [h, m] = start.split(":").map(Number);
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/** Advance a guided flow with the user's reply (text or chip). */
export function advanceFlow(
  state: AgentFlowState,
  input: string,
): FlowStepResult {
  const reply = input.trim();
  if (!reply) {
    return {
      message: "Say something, or tap a chip.",
      chips: ["Cancel"],
      next: state,
    };
  }
  if (/^(cancel|exit|exit guide|stop|stop guide)$/i.test(reply)) {
    return {
      message: "Guide closed — back to chat. Ask anything about your stats, or tap a chip to start again.",
      next: idleFlow(),
      chips: ["What can I bunk?", "Add subject", "Add class", "Set holiday"],
    };
  }

  switch (state.id) {
    case "addSubject":
      return advanceAddSubject(state, reply);
    case "addWeeklySlot":
      return advanceAddSlot(state, reply);
    case "deleteSubject":
      return advanceDeleteSubject(state, reply);
    case "setHoliday":
      return advanceHoliday(state, reply);
    default:
      return {
        message: "What should I do?",
        chips: ["Add subject", "Add class", "Delete subject", "Set holiday"],
        next: idleFlow(),
      };
  }
}

function advanceAddSubject(
  state: AgentFlowState,
  reply: string,
): FlowStepResult {
  const draft = { ...state.draft };

  if (state.step === 0) {
    draft.name = reply;
    draft.shortCode = draft.shortCode || guessShortCode(reply);
    return {
      message: `Got it — “${draft.name}”. Short code? (suggested ${draft.shortCode})`,
      chips: [draft.shortCode, "Cancel"],
      next: { id: "addSubject", step: 1, draft },
    };
  }

  if (state.step === 1) {
    draft.shortCode = reply.replace(/\s+/g, "").slice(0, 16).toUpperCase();
    return {
      message: `Color for ${draft.shortCode}? Tap one or type a hex.`,
      chips: [...SUBJECT_PALETTE.slice(0, 5), "Skip", "Cancel"],
      next: { id: "addSubject", step: 2, draft },
    };
  }

  if (state.step === 2) {
    if (!/^skip$/i.test(reply)) {
      draft.color = reply.startsWith("#") ? reply : reply;
      if (!draft.color.startsWith("#") && SUBJECT_PALETTE.includes(reply as never)) {
        draft.color = reply;
      } else if (!draft.color.startsWith("#")) {
        draft.color = SUBJECT_PALETTE[0];
      }
    }
    return {
      message: `Add subject ${draft.shortCode} (${draft.name})${draft.color ? ` · ${draft.color}` : ""}?`,
      chips: ["Confirm", "Cancel"],
      next: { id: "addSubject", step: 3, draft },
    };
  }

  // step 3 — confirm
  if (!/^confirm$/i.test(reply) && !/^yes$/i.test(reply)) {
    return {
      message: "Tap Confirm to add, or Cancel.",
      chips: ["Confirm", "Cancel"],
      next: state,
    };
  }

  const action: AttendlyAction = {
    type: "addSubject",
    name: draft.name!,
    shortCode: draft.shortCode!,
    ...(draft.color ? { color: draft.color } : {}),
  };

  return {
    message: `Working… adding ${draft.shortCode}.`,
    actions: [action],
    next: idleFlow(),
  };
}

function advanceAddSlot(state: AgentFlowState, reply: string): FlowStepResult {
  const draft = { ...state.draft };
  let step = state.step;
  const periodChips = defaultPeriodSlots().map(
    (p, i) => `${i + 1}. ${p.label} ${p.startTime}`,
  );

  if (!draft.shortCode) {
    draft.shortCode = reply.replace(/\s+/g, "").slice(0, 16).toUpperCase();
    step = 1;
    return {
      message: `Which day for ${draft.shortCode}?`,
      chips: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Cancel"],
      next: { id: "addWeeklySlot", step, draft },
    };
  }

  if (draft.dayOfWeek == null || step === 0) {
    if (draft.dayOfWeek == null) {
      const dow = dayNameToDow(reply);
      if (dow == null) {
        return {
          message: "Pick a weekday.",
          chips: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Cancel"],
          next: state,
        };
      }
      draft.dayOfWeek = String(dow);
    }
    if (draft.slotIndex == null && !draft.startTime) {
      return {
        message: `Which period for ${draft.shortCode}?`,
        chips: [...periodChips, "Cancel"],
        next: { id: "addWeeklySlot", step: 2, draft },
      };
    }
  }

  if (draft.slotIndex == null && !draft.startTime) {
    const periodPick = reply.match(/^(\d+)\b/);
    const slotFromChip = periodPick ? Number(periodPick[1]) - 1 : NaN;
    const periods = defaultPeriodSlots();
    if (
      Number.isInteger(slotFromChip) &&
      slotFromChip >= 0 &&
      slotFromChip < periods.length
    ) {
      draft.slotIndex = String(slotFromChip);
      const slot = periods[slotFromChip]!;
      draft.startTime = slot.startTime;
      draft.endTime = slot.endTime;
    } else {
      return {
        message: "Pick a period chip (custom times aren’t supported — edit slots in Settings).",
        chips: [...periodChips, "Cancel"],
        next: state,
      };
    }
    return {
      message: `Add weekly ${draft.shortCode} on day ${draft.dayOfWeek} at ${draft.startTime}${draft.endTime ? `–${draft.endTime}` : ""}?`,
      chips: ["Confirm", "Cancel"],
      next: { id: "addWeeklySlot", step: 3, draft },
    };
  }

  if (draft.slotIndex == null) {
    return {
      message: "Pick a period chip first (Settings → Daily periods).",
      chips: [...periodChips, "Cancel"],
      next: { id: "addWeeklySlot", step: 2, draft },
    };
  }

  if (!/^confirm$/i.test(reply) && !/^yes$/i.test(reply)) {
    return {
      message: `Add weekly ${draft.shortCode} at ${draft.startTime}?`,
      chips: ["Confirm", "Cancel"],
      next: { id: "addWeeklySlot", step: 3, draft },
    };
  }

  const action: AttendlyAction = {
    type: "addWeeklySlot",
    shortCode: draft.shortCode,
    dayOfWeek: Number(draft.dayOfWeek) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    slotIndex: Number(draft.slotIndex),
  };

  return {
    message: `Working… adding slot for ${draft.shortCode}.`,
    actions: [action],
    next: idleFlow(),
  };
}

function advanceDeleteSubject(
  state: AgentFlowState,
  reply: string,
): FlowStepResult {
  const draft = { ...state.draft };
  if (!draft.shortCode) {
    draft.shortCode = reply.replace(/\s+/g, "").slice(0, 16);
    return {
      message: `Delete subject ${draft.shortCode}? This removes slots and marks.`,
      chips: ["Confirm delete", "Cancel"],
      next: { id: "deleteSubject", step: 1, draft },
      needsConfirm: true,
    };
  }
  if (!/^confirm/i.test(reply) && !/^yes$/i.test(reply)) {
    return {
      message: `Confirm delete ${draft.shortCode}?`,
      chips: ["Confirm delete", "Cancel"],
      next: state,
      needsConfirm: true,
    };
  }
  return {
    message: `Working… deleting ${draft.shortCode}.`,
    actions: [{ type: "deleteSubject", shortCode: draft.shortCode }],
    next: idleFlow(),
  };
}

function advanceHoliday(state: AgentFlowState, reply: string): FlowStepResult {
  const draft = { ...state.draft };
  if (!draft.date) {
    if (/^tomorrow$/i.test(reply)) draft.date = addDaysYmd(todayYmd(), 1);
    else if (/^today$/i.test(reply)) draft.date = todayYmd();
    else if (/^\d{4}-\d{2}-\d{2}$/.test(reply)) draft.date = reply;
    else {
      return {
        message: "Which day is the holiday?",
        chips: ["Today", "Tomorrow", "Cancel"],
        next: state,
      };
    }
  }
  if (state.step < 1 || !/^confirm$/i.test(reply)) {
    if (/^confirm$/i.test(reply) || /^yes$/i.test(reply)) {
      return {
        message: `Working… setting holiday on ${draft.date}.`,
        actions: [{ type: "setHoliday", date: draft.date! }],
        next: idleFlow(),
      };
    }
    return {
      message: `Set holiday on ${draft.date}?`,
      chips: ["Confirm", "Cancel"],
      next: { id: "setHoliday", step: 1, draft },
    };
  }
  return {
    message: `Working… setting holiday on ${draft.date}.`,
    actions: [{ type: "setHoliday", date: draft.date! }],
    next: idleFlow(),
  };
}

/** First prompt after detecting an intent (before user chips). */
export function beginFlow(state: AgentFlowState): FlowStepResult {
  switch (state.id) {
    case "addSubject":
      if (!state.draft.name) {
        return {
          message: "What’s the subject name?",
          chips: ["Cancel"],
          next: state,
        };
      }
      return advanceFlow({ ...state, step: 0 }, state.draft.name);

    case "deleteSubject":
      if (!state.draft.shortCode) {
        return {
          message: "Which subject short code should I delete?",
          chips: ["Cancel"],
          next: state,
        };
      }
      return {
        message: `Delete subject ${state.draft.shortCode}? This removes slots and marks.`,
        chips: ["Confirm delete", "Cancel"],
        next: { id: "deleteSubject", step: 1, draft: state.draft },
        needsConfirm: true,
      };

    case "addWeeklySlot":
      if (!state.draft.shortCode) {
        return {
          message: "Which subject short code?",
          chips: ["Cancel"],
          next: state,
        };
      }
      if (state.draft.dayOfWeek == null) {
        return {
          message: `Which day for ${state.draft.shortCode}?`,
          chips: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Cancel"],
          next: { ...state, step: 1 },
        };
      }
      if (!state.draft.startTime) {
        const periodChips = defaultPeriodSlots().map(
          (p, i) => `${i + 1}. ${p.label} ${p.startTime}`,
        );
        return {
          message: `Which period for ${state.draft.shortCode}?`,
          chips: [...periodChips, "Cancel"],
          next: { ...state, step: 2 },
        };
      }
      return {
        message: `Add weekly ${state.draft.shortCode} on day ${state.draft.dayOfWeek} at ${state.draft.startTime}?`,
        chips: ["Confirm", "Cancel"],
        next: { ...state, step: 3 },
      };

    case "setHoliday":
      if (!state.draft.date) {
        return {
          message: "Which day is the holiday?",
          chips: ["Today", "Tomorrow", "Cancel"],
          next: state,
        };
      }
      return {
        message: `Set holiday on ${state.draft.date}?`,
        chips: ["Confirm", "Cancel"],
        next: { id: "setHoliday", step: 1, draft: state.draft },
      };

    default:
      return {
        message: "What should I do?",
        chips: ["Add subject", "Add class", "Delete subject", "Set holiday"],
        next: idleFlow(),
      };
  }
}

/** Opening prompt when Agent Control mounts (Chat-first). */
export function agentWelcome(): AgentActionsPayload {
  return {
    message:
      "Hi — I’m Attendly chat. Ask about your %, bunks, or risk, or say what I can do. Tap a chip (or switch to Agent) when you want me to change data.",
    actions: [],
    chips: [
      "What can I bunk?",
      "How am I doing?",
      "What can you do?",
      "Add subject",
      "Add class",
      "Set holiday",
    ],
  };
}

export function flowLabel(id: FlowId): string {
  switch (id) {
    case "addSubject":
      return "Add subject";
    case "addWeeklySlot":
      return "Add class";
    case "deleteSubject":
      return "Delete subject";
    case "setHoliday":
      return "Set holiday";
    default:
      return "Guide";
  }
}

// Re-export day helper used by flows (kept next to intent parsing).
export function dayNameToDow(name: string): number | null {
  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  return map[name.trim().toLowerCase()] ?? null;
}
