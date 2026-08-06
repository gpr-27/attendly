"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ClerkAuthControls } from "@/components/shell/clerk-auth-controls";
import { NAV_ITEMS, isNavActive } from "@/components/shell/nav-config";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/utils/cn";

const DRAWER_ID = "mobile-nav-drawer";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNavMenuButton({
  open,
  onOpenChange,
}: MobileNavDrawerProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      onClick={() => onOpenChange(!open)}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink transition hover:bg-mist"
    >
      {open ? (
        <X className="size-5" aria-hidden />
      ) : (
        <Menu className="size-5" aria-hidden />
      )}
    </button>
  );
}

/** Slide-over drawer with all app destinations — mobile only. */
export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation menu"
        onClick={close}
        className={cn(
          "absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        id={DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
        className={cn(
          "safe-area-pt safe-area-pb absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-line bg-surface-raised/98 shadow-xl backdrop-blur-md transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold tracking-tight text-ink">
              Attendly
            </p>
            <p className="text-xs text-mute">Eligibility co-pilot</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={close}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink transition hover:bg-mist"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-mute hover:bg-mist hover:text-ink",
                    )}
                  >
                    {active ? (
                      <span
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand"
                        aria-hidden
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-[1.15rem]",
                        active && "stroke-[2.25px]",
                      )}
                      aria-hidden
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto space-y-3 border-t border-line/60 px-4 py-4">
          <ThemeToggle className="w-full justify-between" />
          <ClerkAuthControls layout="stack" />
          <p className="text-[0.65rem] leading-relaxed text-mute">
            Data stays on this device. Download an attendance PDF from Settings
            (or Analytics / Today) before clearing browser storage.
          </p>
        </div>
      </aside>
    </div>
  );
}
