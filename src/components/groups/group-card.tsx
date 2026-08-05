import Link from "next/link";
import { Building2, Users } from "lucide-react";
import type { Group } from "@/lib/groups/types";
import { Card } from "@/components/ui/card";

type GroupCardProps = {
  group: Group;
};

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Card as="article" className="p-4 transition hover:border-brand/40">
      <Link href={`/groups/${group.id}`} className="block min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-1 min-w-0 text-sm font-semibold leading-snug text-ink">
            {group.name}
          </h2>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
            <Users className="size-3" aria-hidden />
            {group.memberCount}
          </span>
        </div>
        {group.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
            {group.description}
          </p>
        ) : (
          <p className="mt-1 text-xs italic text-mute">No description yet.</p>
        )}
        {group.institution ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-mute">
            <Building2 className="size-3" aria-hidden />
            {group.institution}
          </p>
        ) : null}
      </Link>
    </Card>
  );
}
