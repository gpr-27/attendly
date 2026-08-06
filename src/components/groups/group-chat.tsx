"use client";

import { useAuth } from "@clerk/nextjs";
import { MoreVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer, ChatMessageList } from "@/components/ai/chat-ui";
import { Button } from "@/components/ui/button";
import { useChatPageScroll } from "@/hooks/use-chat-page-scroll";
import {
  deleteGroupMessageRequest,
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
  className?: string;
};

export function GroupChat({ groupId, enabled, className }: GroupChatProps) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCreatedAt = useRef<string | null>(null);
  const initialScrollDone = useRef(false);
  const { bottomRef, scrollToBottom, stickToBottom } = useChatPageScroll([
    messages.length,
    loading,
    sending,
  ]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    initialScrollDone.current = false;
    stickToBottom.current = true;
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
  }, [groupId, stickToBottom]);

  const pollNew = useCallback(async () => {
    if (!lastCreatedAt.current) return;
    const wasNearBottom = stickToBottom.current;
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
      stickToBottom.current = true;
      scrollToBottom("smooth");
    } catch (err) {
      setError(
        err instanceof GroupApiError ? err.message : "Could not send message.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId: string) {
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

      <div aria-live="polite">
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
            return (
              <div
                key={msg.id}
                className={cn(
                  "group/msg flex w-full flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex max-w-[min(92%,32rem)] items-center gap-1 px-1",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <p className="text-[0.6875rem] font-medium text-mute">
                    {label} · {formatTime(msg.createdAt)}
                  </p>
                  {mine ? (
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
                    "max-w-[min(92%,32rem)] rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-[1.6] shadow-[var(--shadow-card)]",
                    mine
                      ? "rounded-br-md bg-brand text-white"
                      : "rounded-bl-md border border-line/70 bg-surface-raised text-ink",
                  )}
                >
                  {msg.body}
                </p>
              </div>
            );
          })
        )}
        </ChatMessageList>
      </div>

      {error ? (
        <p className="mx-4 mb-1 rounded-lg bg-risk-danger-bg px-2 py-1.5 text-xs text-risk-danger">
          {error}
        </p>
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
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-base text-ink outline-none ring-brand/30 focus:ring-2 sm:text-sm"
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "…" : "Send"}
          </Button>
        </form>
      </ChatComposer>
    </div>
  );
}
