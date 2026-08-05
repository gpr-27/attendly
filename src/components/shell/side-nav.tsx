"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/components/shell/nav-config";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/utils/cn";

export function SideNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/onboarding")) return null;

  return (
    <aside className="hidden w-56 shrink-0 md:block lg:w-60">
      <div className="sticky top-0 flex h-dvh flex-col border-r border-line bg-surface-raised/90 px-3 py-5 backdrop-blur-md">
        <div className="mb-6 flex flex-col gap-3 px-2">
          <Link href="/" className="group block min-w-0">
            <p className="font-display text-2xl font-semibold tracking-tight text-ink transition-colors group-hover:text-brand">
              Attendly
            </p>
            <p className="mt-0.5 text-xs text-mute">Eligibility co-pilot</p>
          </Link>
          <ThemeToggle className="w-full justify-between" />
        </div>

        <nav aria-label="Main" className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
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
                  className={cn("size-[1.15rem]", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="mt-auto px-2 text-[0.65rem] leading-relaxed text-mute">
          Data stays on this device. Download an attendance PDF from Settings
          (or Analytics / Today) before clearing browser storage.
        </p>
      </div>
    </aside>
  );
}
