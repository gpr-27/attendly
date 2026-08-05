"use client";

import { useCallback, useEffect, useState } from "react";
import { buildCoachStats } from "@/lib/ai/build-coach-stats";
import {
  localBunkAdviceFromStats,
  looksLikeBunkOrStandingQuestion,
} from "@/lib/ai/local-coach-fallback";
import type { AiStatus, CoachMode, CoachPlan } from "@/lib/ai/schemas";

export type CoachChatMessage = {
  role: "user" | "assistant";
  text: string;
  plan?: CoachPlan;
  usedPolicyResearch?: boolean;
};

type UseCoachChatOptions = {
  /** Page hint for POST /api/ai/coach (optional). */
  pageContext?: string;
  /** Initial mode — chat | digest | plan. */
  mode?: CoachMode;
  /** Extra context appended to pageContext (e.g. selected subject). */
  extraContext?: string;
};

/**
 * Shared Groq coach client — Dexie stats + pageContext → POST /api/ai/coach.
 * Graceful when GROQ_API_KEY missing (setupHint from /api/ai/status).
 */
export function useCoachChat(options: UseCoachChatOptions = {}) {
  const { pageContext, mode: initialMode = "chat", extraContext } = options;

  const [stats, setStats] = useState<Record<string, unknown>>({
    empty: true,
    subjects: [],
    note: "Loading local stats…",
  });
  const [statsReady, setStatsReady] = useState(false);
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [mode, setMode] = useState<CoachMode>(initialMode);
  const [policyResearch, setPolicyResearch] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;
    buildCoachStats()
      .then((payload) => {
        if (!cancelled) {
          setStats(payload);
          setStatsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            empty: true,
            subjects: [],
            note: "Could not load local stats. Coach still answers honestly.",
          });
          setStatsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const resolvedContext = [pageContext, extraContext]
    .filter(Boolean)
    .join("\n");

  const send = useCallback(
    async (
      raw: string,
      overrideMode?: CoachMode,
      opts?: { fresh?: boolean },
    ) => {
      const message = raw.trim();
      if (!message) return;
      if (busy && !opts?.fresh) return;
      const activeMode = overrideMode ?? mode;
      setError(null);
      if (opts?.fresh) {
        setMessages([{ role: "user", text: message }]);
      } else {
        setMessages((prev) => [...prev, { role: "user", text: message }]);
      }
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
            ...(resolvedContext ? { pageContext: resolvedContext } : {}),
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
          if (
            (data.code === "rate_limited" || res.status === 429) &&
            looksLikeBunkOrStandingQuestion(message)
          ) {
            const local = localBunkAdviceFromStats(stats);
            if (local) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", text: local },
              ]);
              return;
            }
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
    },
    [busy, mode, policyResearch, resolvedContext, stats],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /** Replace the thread and send (auto-insight on subject/session focus). */
  const sendFresh = useCallback(
    async (raw: string, overrideMode?: CoachMode) => {
      await send(raw, overrideMode, { fresh: true });
    },
    [send],
  );

  return {
    stats,
    statsReady,
    messages,
    busy,
    error,
    setupHint,
    mode,
    setMode,
    policyResearch,
    setPolicyResearch,
    send,
    sendFresh,
    clear,
  };
}
