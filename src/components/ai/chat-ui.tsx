"use client";

import {
  Fragment,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { Bot, Check, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* —— Lightweight markdown (no extra deps) —— */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let partIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(text.slice(last, index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${partIndex++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-mist/80 px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const labelEnd = token.indexOf("]");
      const url = token.slice(labelEnd + 2, -1);
      const label = token.slice(1, labelEnd);
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
        >
          {label}
        </a>,
      );
    }

    last = index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const ulMatch = /^[-*•]\s+(.+)/.exec(line);
    const olMatch = /^(\d+)\.\s+(.+)/.exec(line);

    if (ulMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m = /^[-*•]\s+(.+)/.exec(lines[i] ?? "");
        if (!m) break;
        items.push(
          <li key={`ul-${blockKey}-${items.length}`} className="pl-0.5">
            {renderInline(m[1] ?? "", `ul-${blockKey}-${items.length}`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ul key={`block-${blockKey++}`} className="ai-chat-list ai-chat-list-disc">
          {items}
        </ul>,
      );
      continue;
    }

    if (olMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m = /^(\d+)\.\s+(.+)/.exec(lines[i] ?? "");
        if (!m) break;
        items.push(
          <li key={`ol-${blockKey}-${items.length}`} className="pl-0.5">
            {renderInline(m[2] ?? "", `ol-${blockKey}-${items.length}`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ol key={`block-${blockKey++}`} className="ai-chat-list ai-chat-list-decimal">
          {items}
        </ol>,
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^[-*•]\s+/.test(lines[i] ?? "") &&
      !/^\d+\.\s+/.test(lines[i] ?? "")
    ) {
      paraLines.push(lines[i] ?? "");
      i += 1;
    }
    blocks.push(
      <p key={`block-${blockKey++}`}>
        {renderInline(paraLines.join(" "), `p-${blockKey}`)}
      </p>,
    );
  }

  return <>{blocks}</>;
}

/** Renders coach/agent prose with lists, inline code, and fenced blocks. */
export function ChatMarkdown({ content }: { content: string }) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const segments = trimmed.split(/(```[\s\S]*?```)/g);

  return (
    <div className="ai-chat-prose">
      {segments.map((segment, index) => {
        if (segment.startsWith("```")) {
          const inner = segment
            .replace(/^```[\w-]*\n?/, "")
            .replace(/\n?```$/, "");
          return (
            <pre key={`code-${index}`} className="ai-chat-code-block">
              <code>{inner.trimEnd()}</code>
            </pre>
          );
        }
        if (!segment.trim()) return null;
        return (
          <Fragment key={`md-${index}`}>
            <MarkdownBlock text={segment} />
          </Fragment>
        );
      })}
    </div>
  );
}

/* —— Message bubbles —— */

type ChatMessageProps = {
  role: "user" | "assistant";
  children: ReactNode;
  className?: string;
  /** Plain text for copy — assistant only. */
  copyText?: string;
  timestamp?: string;
};

export function ChatMessage({
  role,
  children,
  className,
  copyText,
  timestamp,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard optional */
    }
  }, [copyText]);

  return (
    <div
      className={cn(
        "group/msg flex w-full",
        isUser ? "justify-end" : "justify-start",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 max-w-[min(92%,32rem)] gap-2",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        {!isUser ? (
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15"
            aria-hidden
          >
            <Bot className="size-3.5" strokeWidth={2.25} />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "relative rounded-2xl px-4 py-2.5 shadow-[var(--shadow-card)]",
              isUser
                ? "rounded-br-md bg-brand text-white"
                : "rounded-bl-md border border-line/70 bg-surface-raised text-ink",
            )}
          >
            <div
              className={cn(
                "text-[0.9375rem] leading-[1.6]",
                isUser ? "text-white [&_a]:text-white [&_code]:bg-white/15 [&_code]:text-white" : "",
              )}
            >
              {children}
            </div>
            {!isUser && copyText ? (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={cn(
                  "absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border border-line/80 bg-surface-raised text-mute shadow-sm transition",
                  "opacity-0 group-hover/msg:opacity-100 focus:opacity-100",
                  copied && "text-brand",
                )}
                aria-label={copied ? "Copied" : "Copy message"}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </button>
            ) : null}
          </div>
          {timestamp ? (
            <p
              className={cn(
                "mt-1 px-1 text-[0.6875rem] text-mute",
                isUser ? "text-right" : "text-left",
              )}
            >
              {timestamp}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Assistant bubble with markdown body + optional copy. */
export function AssistantMessage({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <ChatMessage role="assistant" copyText={text} className={className}>
      <ChatMarkdown content={text} />
    </ChatMessage>
  );
}

/** User bubble — plain text. */
export function UserMessage({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <ChatMessage role="user" className={className}>
      <p className="whitespace-pre-wrap">{text}</p>
    </ChatMessage>
  );
}

/* —— Status & loading —— */

export function ChatStatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="py-1 text-center text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-mute">
      {children}
    </p>
  );
}

export function ChatTypingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border border-line/70 bg-surface-raised px-4 py-3 shadow-[var(--shadow-card)]">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ai-chat-dot size-1.5 rounded-full bg-brand/70"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
        <span className="text-xs font-medium text-mute">{label}</span>
      </div>
    </div>
  );
}

/* —— Empty state & starters —— */

export function ChatEmptyState({
  title,
  description,
  icon = "sparkles",
}: {
  title: string;
  description: string;
  icon?: "sparkles" | "bot";
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line/80 bg-mist/30 px-4 py-5 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        {icon === "bot" ? (
          <Bot className="size-5" aria-hidden />
        ) : (
          <Sparkles className="size-5" aria-hidden />
        )}
      </span>
      <p className="mt-3 font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
    </div>
  );
}

export function ChatStarterChips({
  starters,
  disabled,
  onPick,
  label,
}: {
  starters: string[];
  disabled?: boolean;
  onPick: (s: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-mute">
          {label}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-full border border-line/80 bg-surface-raised px-3.5 py-2 text-left text-xs font-medium leading-snug text-ink-soft shadow-[var(--shadow-card)] transition hover:border-brand/35 hover:bg-brand/5 hover:text-ink disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* —— Agent mode toggle —— */

export type AgentPanelMode = "chat" | "agent";

export function AgentModeTabs({
  mode,
  guiding,
  onChange,
}: {
  mode: AgentPanelMode;
  guiding?: boolean;
  onChange: (mode: AgentPanelMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-line/80 bg-mist/40 p-1"
      role="tablist"
      aria-label="Chat or Agent mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "chat" && !guiding}
        title="Ask questions about attendance, bunks, and risk — read-only advice"
        onClick={() => onChange("chat")}
        className={cn(
          "min-h-10 rounded-lg px-3.5 py-1.5 text-left transition",
          mode === "chat" && !guiding
            ? "bg-surface-raised text-ink shadow-[var(--shadow-card)]"
            : "text-mute hover:text-ink",
        )}
      >
        <span className="block text-xs font-semibold">Chat</span>
        <span className="block text-[0.625rem] font-normal leading-tight text-mute">
          Q&amp;A
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "agent" || guiding}
        title="Guided changes — add subjects, mark attendance, set holidays"
        onClick={() => onChange("agent")}
        className={cn(
          "min-h-10 rounded-lg px-3.5 py-1.5 text-left transition",
          mode === "agent" || guiding
            ? "bg-surface-raised text-ink shadow-[var(--shadow-card)]"
            : "text-mute hover:text-ink",
        )}
      >
        <span className="block text-xs font-semibold">Agent</span>
        <span className="block text-[0.625rem] font-normal leading-tight text-mute">
          Actions
        </span>
      </button>
    </div>
  );
}

/* —— Message list (document flow — page scrolls) —— */

export function ChatMessageList({
  children,
  className,
  bottomRef,
}: {
  children: ReactNode;
  className?: string;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[42rem] space-y-4 px-4 py-4",
        className,
      )}
    >
      {children}
      <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
    </div>
  );
}

/** Sticky composer bar — sits at bottom while page/panel scrolls. */
export function ChatComposer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 border-t border-line/70 bg-surface-raised/95 px-3 py-3 backdrop-blur-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
