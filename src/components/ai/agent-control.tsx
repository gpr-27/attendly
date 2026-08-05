"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import {
  ActionRunner,
  splitAndRunActions,
} from "@/components/ai/action-runner";
import { SubjectInsightCards } from "@/components/ai/subject-insight-cards";
import {
  AI_PANEL_DOM_ID,
  useAiFocusOptional,
} from "@/components/ai/ai-focus-context";
import {
  executeAttendlyAction,
  extractActionsFromCoachReply,
  type AttendlyAction,
  type AttendlyActionResult,
} from "@/lib/ai/actions";
import {
  advanceFlow,
  agentWelcome,
  beginFlow,
  detectFlowIntent,
  flowLabel,
  idleFlow,
  isAgentEntryChip,
  isChatOnlyMessage,
  isMutativeAgentRequest,
  looksLikeChatAside,
  type AgentFlowState,
} from "@/lib/ai/agent-flows";
import {
  buildAutoInsightPrompt,
  buildFocusPageContext,
  buildInsightCards,
  focusKey,
  type AiFocus,
} from "@/lib/ai/ai-focus";
import { buildCoachStats } from "@/lib/ai/build-coach-stats";
import {
  localBunkAdviceFromStats,
  looksLikeBunkOrStandingQuestion,
} from "@/lib/ai/local-coach-fallback";
import type { AiStatus, CoachPlan } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils/cn";

type ChatLine = {
  role: "user" | "assistant" | "status";
  text: string;
  plan?: CoachPlan;
  actions?: AttendlyAction[];
  results?: AttendlyActionResult[];
  pending?: AttendlyAction[];
  chips?: string[];
};

type AgentControlProps = {
  /** Soft page hint for Groq grounding. */
  pageContext?: string;
  title?: string;
  compact?: boolean;
  /** Fill parent height (full-screen sheet) with sticky input + scrollable history. */
  fill?: boolean;
  className?: string;
  autoFocus?: boolean;
  onClose?: () => void;
  /** Called after Dexie actions succeed so host pages can reload. */
  onDataChanged?: () => void;
  /** Optional controlled focus (Today dock / Coach). */
  focus?: AiFocus | null;
  focusNonce?: number;
};

type AgentStatus = "idle" | "working" | "awaiting" | "done";
type PanelMode = "chat" | "agent";

function localChatFallback(text: string): string {
  const t = text.trim().toLowerCase();
  if (/\bwhat can (u|you|i)\b/.test(t) || t === "help" || /\bcapabilities\b/.test(t)) {
    return "I can: (1) Chat about your %, bunks, risk, and today sessions when GROQ_API_KEY is set; (2) Guide changes via chips — Add subject, Add class, Set holiday, Delete subject, mark/cancel/move. Tap Agent or a chip to change data.";
  }
  if (/^(hi|hey|hello|yo|sup)/.test(t)) {
    return "Hey! Ask how you’re doing, what you can bunk, or tap a chip to change timetable data.";
  }
  if (/^(ok|okay|k|thanks|thank you|thx|cool|nice|great)/.test(t)) {
    return "Got it. Ask another question anytime, or tap Add subject / Set holiday when you want a change.";
  }
  return "Chat advice needs GROQ_API_KEY. Guided chips (Add subject, holiday, …) still work offline — switch to Agent or tap one.";
}

/**
 * Agent Control — Chat (default) + guided Agent walkthroughs on
 * Today / Coach (Insights) / Analytics only.
 */
export function AgentControl({
  pageContext,
  title = "Agent Control",
  compact = true,
  fill = false,
  className,
  autoFocus,
  onClose,
  onDataChanged,
  focus: focusProp,
  focusNonce: focusNonceProp,
}: AgentControlProps) {
  const focusCtx = useAiFocusOptional();
  const focus = focusProp !== undefined ? focusProp : (focusCtx?.focus ?? null);
  const focusNonce =
    focusNonceProp !== undefined
      ? focusNonceProp
      : (focusCtx?.focusNonce ?? 0);

  const [stats, setStats] = useState<Record<string, unknown>>({ empty: true });
  const [statsReady, setStatsReady] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>(() => {
    const w = agentWelcome();
    return [
      {
        role: "assistant",
        text: w.message,
        chips: w.chips,
      },
    ];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [statusLabel, setStatusLabel] = useState("Ready");
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<AgentFlowState>(idleFlow());
  const [mode, setMode] = useState<PanelMode>("chat");
  /** Paused guide while answering a mid-flow chat question. */
  const [pausedFlow, setPausedFlow] = useState<AgentFlowState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRef = useRef<string | null>(null);

  const insightCards = focus ? buildInsightCards(focus) : [];
  const guiding = flow.id !== "idle";

  const refreshStats = useCallback(async () => {
    try {
      const payload = await buildCoachStats();
      setStats(payload);
      setStatsReady(true);
    } catch {
      setStats({
        empty: true,
        subjects: [],
        note: "Could not load local stats.",
      });
      setStatsReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy, insightCards.length]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json() as Promise<AiStatus>)
      .then((s) => {
        if (cancelled) return;
        if (!s.groqConfigured) {
          setSetupHint(
            s.setupHint ??
              "Add GROQ_API_KEY for free-form advice. Guided actions still work offline.",
          );
        } else {
          setSetupHint(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus → local insight cards only on agent pages (no auto Groq spam).
  useEffect(() => {
    if (!focus || !statsReady) return;
    const key = `${focusKey(focus)}:${focusNonce}`;
    if (lastAutoRef.current === key) return;
    lastAutoRef.current = key;

    setLines((prev) => [
      ...prev,
      {
        role: "status",
        text: `Focused on ${focus.name}`,
      },
    ]);

    if (setupHint) return;

    const prompt = buildAutoInsightPrompt(focus);
    void sendToCoach(prompt, { silentUser: true, allowActions: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, focusNonce, statsReady, setupHint]);

  function exitGuide(announce = true) {
    setFlow(idleFlow());
    setPausedFlow(null);
    setMode("chat");
    setStatus("idle");
    setStatusLabel("Ready");
    if (announce) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Guide closed — you’re back in Chat.",
          chips: [
            "What can I bunk?",
            "How am I doing?",
            "Add subject",
            "Add class",
          ],
        },
      ]);
    }
  }

  function setPanelMode(next: PanelMode) {
    if (next === mode) return;
    if (next === "chat" && (guiding || pausedFlow)) {
      exitGuide(true);
      return;
    }
    setMode(next);
    // Mode lives in the header tabs — do not spam history with "Agent mode" blocks.
    if (next === "agent" && !guiding) {
      setStatusLabel("Agent ready");
    } else if (next === "chat") {
      setStatusLabel("Ready");
    }
  }

  async function applyActions(actions: AttendlyAction[]) {
    if (actions.length === 0) return;
    setStatus("working");
    setStatusLabel("Working…");
    const { results, pending } = await splitAndRunActions(actions);
    const okMsgs = results.filter((r) => r.ok).map((r) => r.message);
    if (okMsgs.length) {
      setStatus("done");
      setStatusLabel(`Done: ${okMsgs[okMsgs.length - 1]}`);
      onDataChanged?.();
      await refreshStats();
    }
    if (pending.length) {
      setStatus("awaiting");
      setStatusLabel("Confirm required");
    } else if (!okMsgs.length && results.some((r) => !r.ok)) {
      setStatus("idle");
      setStatusLabel(mode === "agent" ? "Agent ready" : "Ready");
    }
    setLines((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          results: [...(last.results ?? []), ...results],
          pending: [...(last.pending ?? []), ...pending],
          actions,
        };
      } else {
        next.push({
          role: "assistant",
          text: okMsgs[0] ?? "Actions ready.",
          results,
          pending,
          actions,
        });
      }
      return next;
    });
  }

  async function confirmPending(action: AttendlyAction) {
    setBusy(true);
    setStatus("working");
    setStatusLabel("Working…");
    try {
      const result = await executeAttendlyAction(action);
      setStatus(result.ok ? "done" : "idle");
      setStatusLabel(
        result.ok
          ? `Done: ${result.message}`
          : mode === "agent"
            ? "Agent ready"
            : "Ready",
      );
      setLines((prev) =>
        prev.map((line) => ({
          ...line,
          pending: line.pending?.filter((p) => p !== action),
          results: [...(line.results ?? []), result],
        })),
      );
      if (result.ok) {
        onDataChanged?.();
        await refreshStats();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendToCoach(
    message: string,
    opts?: {
      silentUser?: boolean;
      allowActions?: boolean;
      /** Offer Continue setup after answering mid-guide. */
      offerContinue?: boolean;
    },
  ) {
    if (!opts?.silentUser) {
      setLines((prev) => [...prev, { role: "user", text: message }]);
    }
    setBusy(true);
    setStatus("working");
    setStatusLabel("Thinking…");
    setError(null);
    const allowActions = opts?.allowActions === true;
    try {
      const focusExtra = focus ? buildFocusPageContext(focus) : undefined;
      const ctx = [pageContext, focusExtra].filter(Boolean).join("\n");
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats,
          message,
          mode: "chat",
          voiceStyle: true,
          allowActions,
          ...(ctx ? { pageContext: ctx } : {}),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        setupHint?: string;
        code?: string;
        plan?: CoachPlan;
        actions?: AttendlyAction[];
        message?: string;
        chips?: string[];
      };
      if (!res.ok) {
        if (data.code === "missing_key" || res.status === 503) {
          setSetupHint(
            data.setupHint ??
              "Add GROQ_API_KEY for free-form chat. Guided chips still work.",
          );
          setLines((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "Coach advice needs GROQ_API_KEY — but guided actions (Add subject, holiday, …) still run locally. Switch to Agent or tap a chip.",
              chips: ["Add subject", "Add class", "Set holiday"],
            },
          ]);
          return;
        }
        const rateLimited =
          data.code === "rate_limited" || res.status === 429;
        if (rateLimited || looksLikeBunkOrStandingQuestion(message)) {
          const local = looksLikeBunkOrStandingQuestion(message)
            ? localBunkAdviceFromStats(stats)
            : null;
          if (local) {
            setLines((prev) => [
              ...prev,
              {
                role: "assistant",
                text: local,
                chips: ["What can I bunk?", "How am I doing?", "Add subject"],
              },
            ]);
            setStatus("idle");
            setStatusLabel("Ready (local math)");
            return;
          }
        }
        throw new Error(
          data.error ??
            "Coach is temporarily unavailable. Try again shortly — bunk math still works offline.",
        );
      }

      const payload =
        allowActions && data.actions && data.message
          ? {
              message: data.message,
              actions: data.actions,
              chips: data.chips,
            }
          : allowActions
            ? extractActionsFromCoachReply(data.reply ?? data.message ?? "")
            : {
                message: data.reply ?? data.message ?? "",
                actions: [] as AttendlyAction[],
                chips: data.chips,
              };

      const chips = [
        ...(payload.chips ?? []),
        ...(opts?.offerContinue ? ["Continue setup"] : []),
      ].filter((c, i, arr) => arr.indexOf(c) === i);

      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: payload.message,
          plan: data.plan,
          chips: chips.length ? chips : undefined,
          actions: payload.actions,
        },
      ]);

      if (payload.actions.length > 0) {
        await applyActions(payload.actions);
      } else {
        setStatus("idle");
        setStatusLabel(
          guiding
            ? `Guiding: ${flowLabel(flow.id)}`
            : mode === "agent"
              ? "Agent ready"
              : "Ready",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent unavailable");
      setStatus("idle");
      setStatusLabel("Ready");
    } finally {
      setBusy(false);
    }
  }

  async function startLocalFlow(intent: AgentFlowState, userText: string) {
    setMode("agent");
    setPausedFlow(null);
    setLines((prev) => [...prev, { role: "user", text: userText }]);
    const ask = beginFlow(intent);
    setFlow(ask.next);
    setLines((prev) => [
      ...prev,
      {
        role: "assistant",
        text: ask.message,
        chips: ask.chips,
        actions: ask.actions,
      },
    ]);
    if (ask.actions?.length) {
      await applyActions(ask.actions);
    } else {
      setStatus("awaiting");
      setStatusLabel(
        ask.needsConfirm
          ? "Confirm required"
          : `Guiding: ${flowLabel(ask.next.id)}`,
      );
    }
  }

  async function handleSubmit(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (!raw) setInput("");

    // Resume a paused guide
    if (/^(continue|continue setup)$/i.test(text) && pausedFlow) {
      const resume = pausedFlow;
      setPausedFlow(null);
      setMode("agent");
      setLines((prev) => [...prev, { role: "user", text }]);
      const ask = beginFlow(resume);
      setFlow(ask.next);
      setStatus("awaiting");
      setStatusLabel(
        ask.needsConfirm
          ? "Confirm required"
          : `Guiding: ${flowLabel(ask.next.id)}`,
      );
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: ask.message,
          chips: ask.chips,
          actions: ask.actions,
        },
      ]);
      if (ask.actions?.length) await applyActions(ask.actions);
      return;
    }

    // Explicit exit
    if (
      /^(cancel|exit|exit guide|stop|stop guide)$/i.test(text) &&
      (guiding || pausedFlow)
    ) {
      setLines((prev) => [...prev, { role: "user", text }]);
      exitGuide(true);
      return;
    }

    // Active guided flow
    if (flow.id !== "idle") {
      // Mid-guide chat aside — answer, pause flow, offer Continue
      if (looksLikeChatAside(text)) {
        setPausedFlow(flow);
        setFlow(idleFlow());
        setStatusLabel("Guide paused");
        await sendToCoach(text, { allowActions: false, offerContinue: true });
        return;
      }

      setLines((prev) => [...prev, { role: "user", text }]);
      const step = advanceFlow(flow, text);
      setFlow(step.next);
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: step.message,
          chips: step.chips,
          actions: step.actions,
        },
      ]);
      if (step.next.id === "idle") {
        setMode("chat");
        setStatus("idle");
        setStatusLabel("Ready");
      } else {
        setStatus(step.needsConfirm ? "awaiting" : "awaiting");
        setStatusLabel(
          step.needsConfirm
            ? "Confirm required"
            : `Guiding: ${flowLabel(step.next.id)}`,
        );
      }
      if (step.actions?.length) {
        await applyActions(step.actions);
      }
      return;
    }

    // Chip / clear mutative → local walkthrough
    const chipPrompt = isAgentEntryChip(text)
      ? ({
          "add subject": "add a new subject",
          "add class": "add a class slot",
          "set holiday": "set holiday",
          "delete subject": "delete subject",
        }[text.trim().toLowerCase()] ?? text)
      : text;
    const intent = detectFlowIntent(chipPrompt);
    if (intent) {
      await startLocalFlow(intent, text);
      return;
    }

    // Clear mutative NL without a local flow → Agent + Groq actions
    if (isMutativeAgentRequest(text)) {
      setMode("agent");
      await sendToCoach(text, { allowActions: true });
      return;
    }

    // Chat-only / default: grounded Q&A, no action hijack
    if (isChatOnlyMessage(text) && setupHint) {
      setLines((prev) => [
        ...prev,
        { role: "user", text },
        {
          role: "assistant",
          text: localChatFallback(text),
          chips: [
            "Add subject",
            "Add class",
            "Set holiday",
            "What can I bunk?",
          ],
        },
      ]);
      return;
    }

    if (mode === "agent" && !isChatOnlyMessage(text)) {
      await sendToCoach(text, { allowActions: true });
      return;
    }

    await sendToCoach(text, { allowActions: false });
  }

  const placeholder = guiding
    ? "Answer the guide, or ask a question…"
    : mode === "agent"
      ? "Add subject, mark present, set holiday…"
      : "Ask about bunks, risk, or how you’re doing…";

  const agentChips = ["Add subject", "Add class", "Set holiday", "Delete subject"];
  const chatChips = [
    "What can I bunk?",
    "How am I doing?",
    "Add subject",
    "Add class",
  ];

  return (
    <section
      id={AI_PANEL_DOM_ID}
      className={cn(
        "flex flex-col rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        fill
          ? "h-full min-h-0 overflow-hidden"
          : compact
            ? "min-h-[22rem]"
            : "min-h-[28rem]",
        className,
      )}
      aria-label={title}
    >
      <header className="shrink-0 flex items-start justify-between gap-2 border-b border-line/60 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
            <Sparkles className="size-3.5" aria-hidden />
            {title}
          </p>
          <div
            className="mt-2 inline-flex rounded-lg border border-line/80 bg-mist/40 p-0.5"
            role="tablist"
            aria-label="Chat or Agent mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "chat" && !guiding}
              onClick={() => setPanelMode("chat")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition",
                mode === "chat" && !guiding
                  ? "bg-surface text-ink shadow-sm"
                  : "text-mute hover:text-ink",
              )}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "agent" || guiding}
              onClick={() => setPanelMode("agent")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition",
                mode === "agent" || guiding
                  ? "bg-surface text-ink shadow-sm"
                  : "text-mute hover:text-ink",
              )}
            >
              Agent
            </button>
          </div>
          <p
            className={cn(
              "mt-1.5 text-xs font-medium",
              status === "working" && "text-brand",
              status === "done" && "text-risk-safe",
              status === "awaiting" && "text-risk-watch",
              status === "idle" && "text-mute",
            )}
          >
            {busy ? "Working…" : statusLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {guiding || pausedFlow ? (
            <button
              type="button"
              onClick={() => exitGuide(true)}
              className="rounded-lg px-2 py-1.5 text-[0.65rem] font-semibold text-mute hover:bg-mist hover:text-ink"
            >
              Exit guide
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-mute hover:bg-mist hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      {setupHint ? (
        <p className="mx-3 mt-2 shrink-0 rounded-xl bg-mist/80 px-3 py-2 text-xs text-ink-soft">
          {setupHint}
        </p>
      ) : null}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {insightCards.length > 0 ? (
          <SubjectInsightCards
            cards={insightCards}
            title={
              focus
                ? `${focus.name} · instant insights`
                : "Insights"
            }
          />
        ) : null}
        {lines.map((line, i) => {
          // Hide redundant mode banners that used to spam history.
          if (
            line.role === "status" &&
            /^agent mode$/i.test(line.text.trim())
          ) {
            return null;
          }
          // Only show chips on the latest assistant line to avoid repetition.
          const isLastAssistant =
            line.role === "assistant" &&
            i ===
              lines.reduce(
                (last, l, idx) => (l.role === "assistant" ? idx : last),
                -1,
              );
          return (
            <div key={i} className="space-y-1.5">
              {line.role === "status" ? (
                <p className="text-center text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
                  {line.text}
                </p>
              ) : (
                <div
                  className={cn(
                    "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-snug",
                    line.role === "user"
                      ? "ml-auto bg-brand text-white"
                      : "bg-mist/70 text-ink",
                  )}
                >
                  {line.text}
                </div>
              )}
              {line.role === "assistant" ? (
                <ActionRunner
                  actions={line.actions ?? []}
                  results={line.results}
                  pending={line.pending}
                  busy={busy}
                  onConfirm={(a) => void confirmPending(a)}
                  onDismiss={(a) => {
                    setLines((prev) =>
                      prev.map((l) =>
                        l === line
                          ? {
                              ...l,
                              pending: l.pending?.filter((p) => p !== a),
                            }
                          : l,
                      ),
                    );
                    setStatus("idle");
                    setStatusLabel(mode === "agent" ? "Agent ready" : "Ready");
                  }}
                />
              ) : null}
              {isLastAssistant && line.chips && line.chips.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {line.chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSubmit(chip)}
                      className="min-h-8 rounded-full border border-brand/25 bg-brand/5 px-2.5 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-mute">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Working…
          </p>
        ) : null}
      </div>

      {/* Sticky starter chips for current mode — not duplicated into history */}
      {!guiding && !busy ? (
        <div className="shrink-0 flex flex-wrap gap-1.5 border-t border-line/40 px-3 py-2">
          {(mode === "agent" ? agentChips : chatChips).map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => void handleSubmit(chip)}
              className="min-h-8 rounded-full border border-line bg-mist/50 px-2.5 text-xs font-semibold text-ink-soft hover:bg-mist disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mx-3 mb-2 shrink-0 rounded-xl bg-risk-danger-bg px-3 py-2 text-xs text-risk-danger">
          {error}
        </p>
      ) : null}

      <form
        className="shrink-0 flex items-center gap-2 border-t border-line/60 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none ring-brand/30 placeholder:text-mute focus:ring-2"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex size-11 items-center justify-center rounded-xl bg-brand text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
