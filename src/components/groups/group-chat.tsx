"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchGroupMessages,
  GroupApiError,
  sendGroupMessageRequest,
} from "@/lib/groups/client";
import type { GroupMessage } from "@/lib/groups/types";
import { cn } from "@/lib/utils/cn";

const POLL_MS = 3000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type GroupChatProps = {
  groupId: string;
  enabled: boolean;
};

export function GroupChat({ groupId, enabled }: GroupChatProps) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCreatedAt = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGroupMessages(groupId, { limit: 50 });
      setMessages(result.messages);
      lastCreatedAt.current =
        result.messages.length > 0
          ? result.messages[result.messages.length - 1]!.createdAt
          : null;
    } catch (e) {
      setError(
        e instanceof GroupApiError ? e.message : "Could not load chat.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const pollNew = useCallback(async () => {
    if (!lastCreatedAt.current) return;
    try {
      const result = await fetchGroupMessages(groupId, {
        after: lastCreatedAt.current,
      });
      if (result.messages.length === 0) return;
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const msg of result.messages) {
          if (!ids.has(msg.id)) merged.push(msg);
        }
        return merged;
      });
      lastCreatedAt.current =
        result.messages[result.messages.length - 1]!.createdAt;
    } catch {
      /* polling is best-effort */
    }
  }, [groupId]);

  useEffect(() => {
    if (!enabled) return;
    void loadInitial();
  }, [enabled, loadInitial]);

  useEffect(() => {
    if (!enabled || loading) return;
    scrollToBottom();
  }, [enabled, loading, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void pollNew(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, pollNew]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendGroupMessageRequest(groupId, text);
      setDraft("");
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      lastCreatedAt.current = msg.createdAt;
      scrollToBottom();
    } catch (err) {
      setError(
        err instanceof GroupApiError ? err.message : "Could not send message.",
      );
    } finally {
      setSending(false);
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-mist/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink">Join to chat</p>
        <p className="mt-1 text-xs text-mute">
          Messages are visible to group members only.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[20rem] flex-col rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]">
      <div className="border-b border-line px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">
          Group chat
        </p>
        <p className="text-[0.65rem] text-mute">
          Updates every few seconds — no WebSockets in v1.
        </p>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
        aria-live="polite"
      >
        {loading ? (
          <p className="text-sm text-mute">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-mute">No messages yet. Say hi!</p>
        ) : (
          messages.map((msg) => {
            const mine = msg.clerkUserId === userId;
            const label =
              msg.senderName ??
              (mine ? "You" : `Member ${msg.clerkUserId.slice(-4)}`);
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <p className="mb-0.5 text-[0.65rem] font-medium text-mute">
                  {label} · {formatTime(msg.createdAt)}
                </p>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug",
                    mine
                      ? "bg-brand text-white"
                      : "bg-mist text-ink ring-1 ring-line/60",
                  )}
                >
                  {msg.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mx-3 mb-1 rounded-lg bg-risk-danger-bg px-2 py-1.5 text-xs text-risk-danger">
          {error}
        </p>
      ) : null}

      <form
        className="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={handleSend}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          maxLength={2000}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
