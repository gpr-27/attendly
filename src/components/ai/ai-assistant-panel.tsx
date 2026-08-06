"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import {
  AssistantMessage,
  ChatComposer,
  ChatEmptyState,
  ChatMessageList,
  ChatStarterChips,
  ChatTypingIndicator,
  UserMessage,
} from "@/components/ai/chat-ui";
import { useChatPageScroll } from "@/hooks/use-chat-page-scroll";
import { SubjectInsightCards } from "@/components/ai/subject-insight-cards";
import {
  AI_PANEL_DOM_ID,
  useAiFocusOptional,
} from "@/components/ai/ai-focus-context";
import { useCoachChat } from "@/hooks/use-coach-chat";
import {
  buildAutoInsightPrompt,
  buildFocusPageContext,
  buildInsightCards,
  focusKey,
  type AiFocus,
} from "@/lib/ai/ai-focus";
import {
  getPageAiByKey,
  type PageAiKey,
} from "@/lib/ai/page-ai-config";
import type { CoachMode, CoachPlan } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils/cn";

type AiAssistantPanelProps = {
  pageKey: PageAiKey;
  /** Override starters / context from config. */
  extraContext?: string;
  /** Controlled focus (page-owned). Falls back to AiFocusProvider. */
  focus?: AiFocus | null;
  /** Re-trigger auto-insight when bumped (with focus). */
  focusNonce?: number;
  starters?: string[];
  compact?: boolean;
  className?: string;
  autoFocus?: boolean;
  /** Show mode chips (digest/plan) — default on for non-compact. */
  showModes?: boolean;
  onClose?: () => void;
  /**
   * Auto-fetch digest/chat when focus is set.
   * Default true when a focus payload is present.
   */
  autoInsight?: boolean;
  /** Optional scroll container (mobile sheet). Defaults to window. */
  scrollRootRef?: RefObject<HTMLElement | null>;
};

/**
 * Shared stats-grounded coach panel for any route.
 * Uses POST /api/ai/coach (chat|digest|plan) + pageContext.
 * With subject/session focus: instant insight cards + auto coach digest.
 */
export function AiAssistantPanel({
  pageKey,
  extraContext,
  focus: focusProp,
  focusNonce: focusNonceProp,
  starters: startersProp,
  compact = true,
  className,
  autoFocus,
  showModes,
  onClose,
  autoInsight = true,
  scrollRootRef,
}: AiAssistantPanelProps) {
  const config = getPageAiByKey(pageKey);
  const starters = startersProp ?? config.starters;
  const showModeChips = showModes ?? !compact;
  const focusCtx = useAiFocusOptional();

  const focus = focusProp !== undefined ? focusProp : (focusCtx?.focus ?? null);
  const focusNonce =
    focusNonceProp !== undefined
      ? focusNonceProp
      : (focusCtx?.focusNonce ?? 0);

  const focusExtra = focus ? buildFocusPageContext(focus) : undefined;
  const mergedExtra = [extraContext, focusExtra].filter(Boolean).join("\n");

  const {
    stats,
    statsReady,
    messages,
    busy,
    error,
    setupHint,
    mode,
    setMode,
    send,
    sendFresh,
  } = useCoachChat({
    pageContext: config.pageContext,
    mode: config.defaultMode ?? "chat",
    extraContext: mergedExtra || undefined,
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRef = useRef<string | null>(null);

  const empty =
    Boolean(stats.empty) ||
    (Array.isArray(stats.subjects) && stats.subjects.length === 0);

  const insightCards = focus ? buildInsightCards(focus) : [];
  const { bottomRef } = useChatPageScroll(
    [messages, busy, insightCards.length],
    scrollRootRef,
  );
  const focusTitle =
    focus?.kind === "subject"
      ? `${focus.name} · instant insights`
      : focus?.kind === "session"
        ? `${focus.name} · should I attend?`
        : undefined;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Auto-insight when focus opens / re-clicks — one coach call, no typing.
  useEffect(() => {
    if (!autoInsight || !focus || !statsReady) return;
    if (setupHint) return;
    const key = `${focusKey(focus)}:${focusNonce}`;
    if (lastAutoRef.current === key) return;
    lastAutoRef.current = key;
    const prompt = buildAutoInsightPrompt(focus);
    const digestMode: CoachMode =
      focus.kind === "subject" ? "digest" : "chat";
    void sendFresh(prompt, digestMode);
    // sendFresh identity changes with busy/stats — key gate prevents loops
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional focus-driven trigger
  }, [autoInsight, focus, focusNonce, statsReady, setupHint]);

  async function submit(raw?: string, overrideMode?: CoachMode) {
    const text = (raw ?? input).trim();
    if (!text) return;
    if (!raw) setInput("");
    await send(text, overrideMode);
  }

  const showStarters = messages.length === 0 || !busy;

  return (
    <section
      id={AI_PANEL_DOM_ID}
      className={cn(
        "rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        focus && "ring-2 ring-brand/25",
        className,
      )}
      aria-label={config.title}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-line/70 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
            {focus ? `${focus.name} co-pilot` : config.title}
          </h2>
          <p className="text-xs leading-snug text-mute">
            {focus
              ? "Insights from your marks — then ask a follow-up."
              : `Stats-grounded${empty ? " (zeros until you mark)" : ""}. Rules own the numbers.`}
          </p>
        </div>
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
      </header>

      {showModeChips ? (
        <div className="flex shrink-0 gap-1 border-b border-line/50 px-4 py-2">
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
                  ? "bg-mist text-ink"
                  : "text-mute hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {setupHint ? (
        <p className="mx-3 mt-3 shrink-0 rounded-xl border border-risk-watch/30 bg-risk-watch-bg px-3 py-2 text-xs text-ink">
          <span className="font-semibold">Coach setup: </span>
          {setupHint}
          {insightCards.length > 0
            ? " Local insight cards below still work without a key."
            : ""}
        </p>
      ) : null}

      {insightCards.length > 0 ? (
        <div className="shrink-0 border-b border-line/50 px-4 py-3">
          <SubjectInsightCards cards={insightCards} title={focusTitle} />
        </div>
      ) : null}

      <ChatMessageList bottomRef={bottomRef}>
        {messages.length === 0 && !busy ? (
          <div className="space-y-4">
            {focus && !setupHint ? (
              <ChatTypingIndicator label="Pulling digest…" />
            ) : (
              <ChatEmptyState
                title={focus ? `${focus.name} co-pilot` : "Ask your coach"}
                description={
                  focus && setupHint
                    ? "Local cards above use your Dexie marks. Add GROQ_API_KEY for a written digest."
                    : empty
                      ? "No marks yet — ask how to set up. I'll stay honest about empty stats."
                      : "Pick a prompt — answers use your real attendance stats."
                }
              />
            )}
            {showStarters ? (
              <ChatStarterChips
                starters={starters}
                disabled={busy || Boolean(setupHint)}
                onPick={(s) => void submit(s, mode)}
              />
            ) : null}
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className="space-y-2">
                {m.role === "user" ? (
                  <UserMessage text={m.text} />
                ) : (
                  <AssistantMessage text={m.text} />
                )}
                {m.plan ? <MiniPlan plan={m.plan} /> : null}
              </div>
            ))}
            {showStarters && messages.length > 0 && !busy ? (
              <ChatStarterChips
                starters={starters}
                disabled={Boolean(setupHint)}
                onPick={(s) => void submit(s, mode)}
                label="Follow-up"
              />
            ) : null}
          </>
        )}
        {busy ? <ChatTypingIndicator /> : null}
      </ChatMessageList>

      {error ? (
        <p className="mx-3 mb-2 shrink-0 rounded-xl bg-risk-danger-bg px-3 py-2 text-xs text-risk-danger">
          {error}
        </p>
      ) : null}

      <ChatComposer>
        <form
          className="mx-auto flex max-w-[42rem] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
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
              : focus
                ? "Ask a follow-up…"
                : "Ask the coach…"
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
            <Send className="size-4" />
          )}
        </button>
        </form>
      </ChatComposer>
    </section>
  );
}

function MiniPlan({ plan }: { plan: CoachPlan }) {
  return (
    <div className="ml-9 rounded-xl border border-line/70 bg-surface px-3.5 py-2.5 text-xs text-ink shadow-[var(--shadow-card)]">
      {plan.weekFocus ? (
        <p className="font-semibold">{plan.weekFocus}</p>
      ) : (
        <p className="font-semibold">Week plan</p>
      )}
      {plan.protect.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-mute">
          {plan.protect.map((p) => (
            <li key={`p-${p.shortCode}`}>
              <span className="font-semibold text-risk-danger">
                Protect {p.shortCode}
              </span>{" "}
              — {p.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Compact tip strip for onboarding — non-blocking. */
export function AiOnboardingTip() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-3.5 py-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Tip</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          Pick a realistic college minimum, then add a small buffer so Warning
          fires before you’re Critical. You can change this later in Settings.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-lg p-1.5 text-mute hover:bg-mist hover:text-ink"
        aria-label="Dismiss tip"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
