import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Home,
  Lightbulb,
  Map,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show in compact bottom nav (mobile primary tabs). */
  primary?: boolean;
};

/** Full app destinations — side nav shows all; bottom nav uses primary only. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home, primary: true },
  { href: "/timetable", label: "Timetable", icon: CalendarDays, primary: true },
  { href: "/subjects", label: "Subjects", icon: BookOpen, primary: true },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/insights", label: "Coach", icon: Lightbulb, primary: true },
  { href: "/plan", label: "Plan", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings, primary: true },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
