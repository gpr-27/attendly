"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils/cn";

const PRIMARY = NAV_ITEMS.filter((item) => item.primary);

/** Mobile-only bottom tab bar. Hidden from md breakpoint up (side nav takes over). */
export function BottomNav() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Main"
      className="safe-area-pb fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface-raised/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch justify-between px-1">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium transition-colors",
                  active
                    ? "text-brand"
                    : "text-mute hover:text-ink",
                )}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
