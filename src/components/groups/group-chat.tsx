"use client";

import { useAuth } from "@clerk/nextjs";
import { MoreVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer, ChatMessageList } from "@/components/ai/chat-ui";
import { useChatPageScroll } from "@/hooks/use-chat-page-scroll";
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
  const sendLockUntil = useRef(0);
  const lastCreatedAt = useRef<string | null>(null);
  const { bottomRef, scrollToBottom, stickToBottom } = useChatPageScroll([
    enabled,
    loading,
    messages.length,
  ]);

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
      const wasNearBottom = stickToBottom.current;
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
  }, [groupId, stickToBottom]);

  useEffect(() => {
    if (!enabled) return;
    void loadInitial();
  }, [enabled, loadInitial]);

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
        "rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="border-b border-line px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">
          Group chat
        </p>
      </div>

      <ChatMessageList bottomRef={bottomRef}>
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
                  "group/msg flex w-full",
                  mine ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "flex min-w-0 max-w-[min(92%,32rem)] flex-col gap-0.5",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      mine ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <p className="px-1 text-[0.6875rem] font-medium text-mute">
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
                            menuOpen
                              ? "opacity-100"
                              : "opacity-0 group-hover/msg:opacity-100 focus:opacity-100",
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
                      "rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-[1.6] shadow-[var(--shadow-card)] transition-opacity",
                      mine
                        ? "rounded-br-md bg-brand text-white"
                        : "rounded-bl-md border border-line/70 bg-surface-raised text-ink",
                      optimistic && "opacity-80",
                    )}
                  >
                    {msg.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </ChatMessageList>

      {error ? (
        <div className="mx-3 mb-1 space-y-1">
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

      <ChatComposer>
        <form
          className="mx-auto flex max-w-[42rem] gap-2"
          onSubmit={handleSend}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the group…"
            maxLength={2000}
            enterKeyHint="send"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none ring-brand/30 placeholder:text-mute focus:ring-2"
          />
          <Button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full transition-transform duration-75 active:scale-95"
          >
            Send
          </Button>
        </form>
      </ChatComposer>
    </div>
  );
}
