"use client";

import Link from "next/link";
import {
  CalendarDays,
  Camera,
  MessageSquareText,
  Settings,
} from "lucide-react";
import { EmptyHub } from "@/components/ui/empty-hub";

type TodayEmptyHubProps = {
  dayLabel: string;
  targetPct: number;
  onAskCoach?: () => void;
};

/**
 * Today-specific empty hub — CTAs from the UI component map.
 * Map path: `src/components/today/empty-hub.tsx`
 */
export function TodayEmptyHub({
  dayLabel,
  targetPct,
  onAskCoach,
}: TodayEmptyHubProps) {
  return (
    <EmptyHub
      title="Build your Today ritual"
      description={`${dayLabel} — no classes loaded yet. Attendly never invents attendance. Pick a path below; target stays ${targetPct}%.`}
      actions={[
        {
          href: "/timetable",
          title: "Set up timetable",
          blurb: "Day chips, copy day, extras — your living week plan.",
          icon: CalendarDays,
          primary: true,
        },
        {
          href: "/import",
          title: "Import photo",
          blurb: "Snap a timetable — Gemini drafts subjects & slots to confirm.",
          icon: Camera,
          primary: true,
        },
        {
          title: "Ask AI coach",
          blurb: "Groq answers from your live stats — even zeros while you set up.",
          icon: MessageSquareText,
          onClick: onAskCoach,
          href: onAskCoach ? undefined : "/insights",
        },
        {
          href: "/settings",
          title: "Open settings",
          blurb: "Criteria, buffer, semester label, attendance PDF.",
          icon: Settings,
        },
      ]}
      footer={
        <>
          Also useful:{" "}
          <Link href="/plan" className="font-medium text-brand hover:underline">
            Plan bunks
          </Link>
          {" · "}
          <Link
            href="/subjects"
            className="font-medium text-brand hover:underline"
          >
            Subject rings
          </Link>
          {" · "}
          <Link
            href="/calendar"
            className="font-medium text-brand hover:underline"
          >
            Month view
          </Link>
        </>
      }
    />
  );
}

/** Alias matching the component map name. */
export { TodayEmptyHub as EmptyHub };
