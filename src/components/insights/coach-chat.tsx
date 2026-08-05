"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WEEKLY_DIGEST_MESSAGE } from "@/lib/ai/prompts";
import type { AiStatus, CoachMode, CoachPlan } from "@/lib/ai/schemas";

type Message = {
  role: "user" | "assistant";
  text: string;
  plan?: CoachPlan;
  usedPolicyResearch?: boolean;
};

type CoachChatProps = {
  stats: Record<string, unknown>;
  /** Compact panel mode for Today desktop / mobile drawer. */
  compact?: boolean;
  className?: string;
  /** Autofocus composer when opened from Today. */
  autoFocus?: boolean;
  /** Soft page hint for coach grounding. */
  pageContext?: string;
};

const STARTERS = [
  "Can I bunk anything this week?",
  "What should I prioritize today?",
  "How do I get above target?",
];

/**
 * Groq coach chat v2 — digest / plan / voice style; optional policy research.
 * Local-first: setup hint when GROQ key missing; bunk math never blocked.
 */
export function CoachChat({
  stats,
  compact,
  className,
  autoFocus,
  pageContext,
}: CoachChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [mode, setMode] = useState<CoachMode>("chat");
  const [policyResearch, setPolicyResearch] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const empty =
    Boolean(stats.empty) ||
    (Array.isArray(stats.subjects) && stats.subjects.length === 0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json() as Promise<AiStatus>)
      .then((status) => {
        if (cancelled) return;
        if (!status.groqConfigured) {
          setSetupHint(
            status.setupHint ??
              "Add GROQ_API_KEY to .env.local (or Vercel), then restart. Bunk math still works offline.",
          );
        } else {
          setSetupHint(null);
        }
      })
      .catch(() => {
        /* status probe optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(raw?: string, overrideMode?: CoachMode) {
    const message = (raw ?? input).trim();
    if (!message || busy) return;
    const activeMode = overrideMode ?? mode;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats,
          message,
          mode: activeMode,
          voiceStyle: true,
          policyResearch,
          ...(pageContext ? { pageContext } : {}),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        setupHint?: string;
        code?: string;
        plan?: CoachPlan;
        usedPolicyResearch?: boolean;
      };
      if (!res.ok) {
        if (data.code === "missing_key" || res.status === 503) {
          setSetupHint(
            data.setupHint ??
              "Add GROQ_API_KEY to .env.local — coach needs it; bunk math does not.",
          );
        }
        throw new Error(
          data.error ??
            "Coach is temporarily unavailable. Try again shortly — bunk math still works offline.",
        );
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "",
          plan: data.plan,
          usedPolicyResearch: data.usedPolicyResearch,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-line/80 bg-surface-raised",
        compact
          ? "min-h-[22rem]"
          : "min-h-[32rem] lg:min-h-[min(36rem,calc(100dvh-10rem))] lg:max-h-[calc(100dvh-8rem)]",
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-line/70 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">
            AI coach
          </h2>
          <p className="text-xs leading-snug text-mute">
            Stats-grounded only
            {empty ? " (zeros until you mark)" : ""}. Rules own the numbers.
          </p>
        </div>
      </header>

      {!compact ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line/50 px-4 py-2.5">
          <div className="flex gap-1 rounded-full bg-mist p-0.5">
            {(
              [
                ["chat", "Chat"],
                ["digest", "Digest"],
                ["plan", "Plan"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  mode === value
                    ? "bg-surface-raised text-ink shadow-sm"
                    : "text-mute hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[0.7rem] text-mute">
            <input
              type="checkbox"
              checked={policyResearch}
              onChange={(e) => setPolicyResearch(e.target.checked)}
              className="size-3.5 rounded border-line"
            />
            Policy research
            <span className="hidden sm:inline">(off by default)</span>
          </label>
        </div>
      ) : null}

      {setupHint ? (
        <p className="mx-4 mt-3 shrink-0 rounded-xl border border-risk-watch/30 bg-risk-watch-bg px-3 py-2 text-xs text-ink">
          <span className="font-semibold">Coach setup: </span>
          {setupHint}
        </p>
      ) : null}

      <div
        ref={listRef}
        className={cn(
          "min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3",
          compact ? "max-h-64 min-h-[12rem]" : "min-h-[14rem]",
        )}
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              {empty
                ? "No marks yet — ask how to set up, or what to do first. I’ll stay honest about empty stats."
                : "Ask about bunks, recovery, or run a weekly digest."}
            </p>
            <div className="flex flex-wrap gap-2">
              {!compact ? (
                <button
                  type="button"
                  disabled={busy || Boolean(setupHint)}
                  onClick={() => {
                    setMode("digest");
                    void send(WEEKLY_DIGEST_MESSAGE, "digest");
                  }}
                  className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-left text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50"
                >
                  This week’s digest
                </button>
              ) : null}
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || Boolean(setupHint)}
                  onClick={() => void send(s, "chat")}
                  className="rounded-full border border-line bg-mist/50 px-3 py-1.5 text-left text-xs font-medium text-ink-soft transition hover:border-brand/30 hover:bg-brand/5 hover:text-ink disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={`${m.role}-${i}`} className="space-y-2">
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-8 bg-brand text-white"
                    : "mr-6 bg-mist/70 text-ink ring-1 ring-line/60",
                )}
              >
                {m.text}
              </div>
              {m.plan ? <PlanCard plan={m.plan} /> : null}
              {m.usedPolicyResearch ? (
                <p className="mr-6 text-[0.65rem] text-mute">
                  Included optional policy research (not used for %).
                </p>
              ) : null}
            </div>
          ))
        )}
        {busy ? (
          <p className="inline-flex items-center gap-2 text-xs text-mute">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Thinking…
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mx-4 mb-2 shrink-0 rounded-xl bg-risk-danger-bg px-3 py-2 text-xs text-risk-danger">
          {error}
        </p>
      ) : null}

      <form
        className="flex shrink-0 gap-2 border-t border-line/70 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={inputRef}
          className="min-h-11 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none ring-brand/30 placeholder:text-mute focus:ring-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            setupHint
              ? "Coach needs GROQ_API_KEY…"
              : empty
                ? "How do I get started?"
                : mode === "digest"
                  ? "Ask for this week’s digest…"
                  : mode === "plan"
                    ? "Build a week plan…"
                    : "Can I bunk tomorrow?"
          }
          disabled={busy || Boolean(setupHint)}
          aria-label="Message AI coach"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || Boolean(setupHint)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-deep disabled:opacity-50"
          aria-label="Send"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
        </button>
      </form>
    </section>
  );
}

function PlanCard({ plan }: { plan: CoachPlan }) {
  return (
    <div className="mr-6 rounded-xl border border-line/70 bg-surface px-3 py-2.5 text-xs text-ink">
      {plan.weekFocus ? (
        <p className="font-semibold text-ink">{plan.weekFocus}</p>
      ) : (
        <p className="font-semibold text-ink">Week plan</p>
      )}
      {plan.protect.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {plan.protect.map((p) => (
            <li key={`p-${p.shortCode}`}>
              <span className="font-semibold text-risk-danger">
                Protect {p.shortCode}
              </span>
              <span className="text-mute"> — {p.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {plan.canRelax && plan.canRelax.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {plan.canRelax.map((p) => (
            <li key={`r-${p.shortCode}`}>
              <span className="font-semibold text-risk-safe">
                Relax {p.shortCode}
              </span>
              <span className="text-mute"> — {p.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {plan.actions && plan.actions.length > 0 ? (
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-mute">
          {plan.actions.map((a, i) => (
            <li key={`a-${i}`}>{a}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
