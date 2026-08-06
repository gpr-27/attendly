"use client";

import { useAuth } from "@clerk/nextjs";
import { MoreVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteGroupMessageRequest,
  fetchGroupMessages,
  GroupApiError,
  sendGroupMessageRequest,
} from "@/lib/groups/client";
import type { GroupMessage } from "@/lib/groups/types";
import { cn } from "@/lib/utils/cn";

const POLL_MS = 3000;
const NEAR_BOTTOM_PX = 80;
const SEND_DEBOUNCE_MS = 400;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOptimisticId(id: string): boolean {
  return id.startsWith("pending-");
}

type GroupChatProps = {
  groupId: string;
  enabled: boolean;
  className?: string;
};

export function GroupChat({ groupId, enabled, className }: GroupChatProps) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryDraft, setRetryDraft] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCreatedAt = useRef<string | null>(null);
  const stickToBottom = useRef(true);
  const initialScrollDone = useRef(false);
  const sendLockUntil = useRef(0);

  const isNearBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    initialScrollDone.current = false;
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
      const wasNearBottom = isNearBottom();
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
      if (wasNearBottom) stickToBottom.current = true;
    } catch {
      /* polling is best-effort */
    }
  }, [groupId, isNearBottom]);

  useEffect(() => {
    if (!enabled) return;
    void loadInitial();
  }, [enabled, loadInitial]);

  useEffect(() => {
    if (!enabled || loading) return;
    if (!stickToBottom.current) return;
    const behavior: ScrollBehavior = initialScrollDone.current ? "smooth" : "auto";
    scrollToBottom(behavior);
    initialScrollDone.current = true;
  }, [enabled, loading, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void pollNew(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, pollNew]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpenId]);

  function handleListScroll() {
    stickToBottom.current = isNearBottom();
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !userId) return;
    const now = Date.now();
    if (now < sendLockUntil.current) return;
    sendLockUntil.current = now + SEND_DEBOUNCE_MS;

    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: GroupMessage = {
      id: tempId,
      groupId,
      clerkUserId: userId,
      body: text,
      createdAt: new Date().toISOString(),
      senderName: "You",
      pending: true,
    };

    setDraft("");
    setError(null);
    setRetryDraft(null);
    setMessages((prev) => [...prev, optimistic]);
    stickToBottom.current = true;
    requestAnimationFrame(() => scrollToBottom("smooth"));

    void (async () => {
      try {
        const msg = await sendGroupMessageRequest(groupId, text);
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === msg.id)) return withoutTemp;
          return [...withoutTemp, msg];
        });
        lastCreatedAt.current = msg.createdAt;
      } catch (err) {
        const message =
          err instanceof GroupApiError ? err.message : "Could not send message.";
        setError(message);
        setRetryDraft(text);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(text);
      }
    })();
  }

  async function handleDelete(messageId: string) {
    if (isOptimisticId(messageId)) return;
    setMenuOpenId(null);
    setDeletingId(messageId);
    setError(null);
    try {
      await deleteGroupMessageRequest(groupId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(
        err instanceof GroupApiError ? err.message : "Could not delete message.",
      );
    } finally {
      setDeletingId(null);
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
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-line px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">
          Group chat
        </p>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3"
        aria-live="polite"
        onScroll={handleListScroll}
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
            const menuOpen = menuOpenId === msg.id;
            const optimistic = msg.pending === true;
            return (
              <div
                key={msg.id}
                className={cn(
                  "group/msg flex flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "mb-0.5 flex max-w-[85%] items-center gap-1",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <p className="text-[0.65rem] font-medium text-mute">
                    {label} · {formatTime(msg.createdAt)}
                    {optimistic ? " · sending…" : null}
                  </p>
                  {mine && !optimistic ? (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label="Message options"
                        aria-expanded={menuOpen}
                        disabled={deletingId === msg.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpen ? null : msg.id);
                        }}
                        className={cn(
                          "flex min-h-7 min-w-7 items-center justify-center rounded-md text-mute transition-opacity hover:bg-mist hover:text-ink",
                          menuOpen ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100 focus:opacity-100",
                        )}
                      >
                        <MoreVertical className="size-3.5" aria-hidden />
                      </button>
                      {menuOpen ? (
                        <div
                          role="menu"
                          className="absolute top-full z-10 mt-1 min-w-[7rem] rounded-lg border border-line bg-surface py-1 shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-risk-danger hover:bg-risk-danger-bg"
                            onClick={() => void handleDelete(msg.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug transition-opacity",
                    mine
                      ? "bg-brand text-white"
                      : "bg-mist text-ink ring-1 ring-line/60",
                    optimistic && "opacity-80",
                  )}
                >
                  {msg.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
      </div>

      {error ? (
        <div className="mx-3 mb-1 shrink-0 space-y-1">
          <p className="rounded-lg bg-risk-danger-bg px-2 py-1.5 text-xs text-risk-danger">
            {error}
          </p>
          {retryDraft ? (
            <button
              type="button"
              onClick={() => {
                setDraft(retryDraft);
                setRetryDraft(null);
                setError(null);
              }}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Tap to retry
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex shrink-0 gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={handleSend}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          maxLength={2000}
          enterKeyHint="send"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink outline-none ring-brand/30 focus:ring-2 sm:text-sm"
        />
        <Button
          type="submit"
          disabled={!draft.trim()}
          className="transition-transform duration-75 active:scale-95"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
