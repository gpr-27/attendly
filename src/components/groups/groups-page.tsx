"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyHub } from "@/components/ui/empty-hub";
import { GroupCard } from "@/components/groups/group-card";
import { fetchGroups, GroupApiError } from "@/lib/groups/client";
import type { Group } from "@/lib/groups/types";

const PAGE_SIZE = 20;

export function GroupsPage() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (q: string, pageToLoad: number, append: boolean) => {
    const id = ++requestId.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchGroups({ q, page: pageToLoad, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return;
      setGroups((prev) => (append ? [...prev, ...result.groups] : result.groups));
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(
        e instanceof GroupApiError ? e.message : "Could not load groups. Try again.",
      );
    } finally {
      if (id !== requestId.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Debounce search input.
  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query, 1, false);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Study together"
        title="Groups"
        description="Find public groups, join in a tap, and chat with classmates. No attendance data is ever shared here."
        actions={
          <Link href="/groups/new">
            <Button large>
              <Users className="size-4" aria-hidden />
              Create group
            </Button>
          </Link>
        }
      />

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mute"
          aria-hidden
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search public groups by name…"
          aria-label="Search public groups"
          className="min-h-11 w-full rounded-full border border-line bg-surface-raised py-2.5 pl-10 pr-10 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-mute hover:bg-mist hover:text-ink"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-line bg-surface-raised"
            />
          ))}
        </ul>
      ) : groups.length === 0 ? (
        query ? (
          <div className="rounded-2xl border border-line/80 bg-surface-raised px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">
              No groups match &ldquo;{query}&rdquo;.
            </p>
            <p className="mt-1 text-sm text-mute">
              Try a different search, or start a new group for it.
            </p>
          </div>
        ) : (
          <EmptyHub
            eyebrow="No groups yet"
            title="Be the first to start one"
            description="Public groups are searchable by every signed-in Attendly user. Create one for your class, club, or study circle."
            actions={[
              {
                href: "/groups/new",
                title: "Create a group",
                blurb: "Name it, add a short description, done.",
                icon: Users,
                primary: true,
              },
            ]}
          />
        )
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <li key={group.id}>
                <GroupCard group={group} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="secondary"
                disabled={loadingMore}
                onClick={() => void load(query, page + 1, true)}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
