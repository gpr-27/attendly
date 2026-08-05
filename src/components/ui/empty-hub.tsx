"use client";

import Link from "next/link";
import { Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type EmptyHubAction = {
  title: string;
  blurb: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  primary?: boolean;
};

type EmptyHubProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions: EmptyHubAction[];
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Reusable rich empty state — pattern wash + CTA grid.
 * Never invents data; only real navigation / callbacks.
 */
export function EmptyHub({
  eyebrow = "Start here",
  title,
  description,
  actions,
  footer,
  className,
}: EmptyHubProps) {
  return (
    <section
      className={cn(
        "rise relative overflow-hidden rounded-2xl border border-line/80 bg-surface-raised",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          background: `
            radial-gradient(80% 60% at 0% 0%, color-mix(in oklab, var(--brand) 18%, transparent), transparent 55%),
            radial-gradient(70% 50% at 100% 10%, color-mix(in oklab, var(--risk-watch) 12%, transparent), transparent 50%),
            repeating-linear-gradient(
              -18deg,
              transparent,
              transparent 11px,
              color-mix(in oklab, var(--line) 55%, transparent) 11px,
              color-mix(in oklab, var(--line) 55%, transparent) 12px
            )
          `,
        }}
      />

      <div className="relative px-5 py-6 sm:px-7 sm:py-8">
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
          <Sparkles className="size-3.5" aria-hidden />
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          {description}
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            const className = action.primary
              ? "border-brand/25 bg-brand/[0.07] hover:bg-brand/12"
              : "border-line bg-surface-raised/90 hover:bg-mist/60";
            const inner = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-brand shadow-sm ring-1 ring-line/80">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-ink">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-mute">
                    {action.blurb}
                  </span>
                </span>
              </>
            );

            return (
              <li key={action.title}>
                {action.onClick ? (
                  <button
                    type="button"
                    onClick={action.onClick}
                    className={`flex h-full w-full gap-3 rounded-xl border px-4 py-3.5 text-left transition ${className}`}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    href={action.href ?? "/"}
                    className={`flex h-full gap-3 rounded-xl border px-4 py-3.5 transition ${className}`}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {footer ? <div className="mt-5 text-xs text-mute">{footer}</div> : null}
      </div>
    </section>
  );
}
