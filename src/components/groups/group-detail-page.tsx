"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Users } from "lucide-react";
import { GroupChat } from "@/components/groups/group-chat";
import { GroupMembersSheet } from "@/components/groups/group-members-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchGroupDetail,
  fetchGroupMembers,
  GroupApiError,
  joinGroupRequest,
  leaveGroupRequest,
} from "@/lib/groups/client";
import type { GroupDetail, GroupMember } from "@/lib/groups/types";

export function GroupDetailPage() {
  const params = useParams();
  const groupId = typeof params.id === "string" ? params.id : "";
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    try {
      const detail = await fetchGroupDetail(groupId);
      setGroup(detail);
    } catch (e) {
      setError(
        e instanceof GroupApiError ? e.message : "Could not load this group.",
      );
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const result = await fetchGroupMembers(groupId);
      setMembers(result.members);
    } catch (e) {
      setMembersError(
        e instanceof GroupApiError ? e.message : "Could not load members.",
      );
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!membersOpen) return;
    void loadMembers();
  }, [membersOpen, loadMembers]);

  async function handleJoin() {
    if (!groupId) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await joinGroupRequest(groupId);
      setNotice("You joined the group.");
      await reload();
    } catch (e) {
      setError(e instanceof GroupApiError ? e.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!groupId) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await leaveGroupRequest(groupId);
      setNotice("You left the group.");
      await reload();
    } catch (e) {
      setError(e instanceof GroupApiError ? e.message : "Could not leave.");
    } finally {
      setBusy(false);
    }
  }

  if (!groupId) {
    return (
      <main className="px-4 py-10">
        <p className="text-sm text-risk-danger">Invalid group link.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <p className="text-sm text-mute">Loading group…</p>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/groups"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to groups
        </Link>
        <p className="text-sm text-risk-danger">
          {error ?? "Group not found."}
        </p>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8">
        <Link
          href="/groups"
          className="mb-3 inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium text-mute hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to groups
        </Link>

        <Card className="mb-3 shrink-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
                Public group
              </p>
              <h1 className="font-display mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {group.name}
              </h1>
              {group.description ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft sm:line-clamp-none">
                  {group.description}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand ring-1 ring-brand/20 transition hover:bg-brand/15"
                  aria-label={`View ${group.memberCount} members`}
                >
                  <Users className="size-4" aria-hidden />
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </button>
                {group.institution ? (
                  <span className="inline-flex items-center gap-1 text-xs text-mute">
                    <Building2 className="size-3.5" aria-hidden />
                    {group.institution}
                  </span>
                ) : null}
                {group.isMember && group.myRole ? (
                  <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-mute">
                    {group.myRole}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {group.isMember ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleLeave()}
                >
                  Leave group
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void handleJoin()}>
                  Join group
                </Button>
              )}
            </div>
          </div>
        </Card>

        {error ? (
          <p className="mb-2 shrink-0 rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-2 shrink-0 rounded-2xl bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe">
            {notice}
          </p>
        ) : null}

        <GroupChat
          groupId={groupId}
          enabled={group.isMember}
          className="min-h-0 flex-1"
        />
      </main>

      <GroupMembersSheet
        open={membersOpen}
        groupName={group.name}
        members={members}
        loading={membersLoading}
        error={membersError}
        onClose={() => setMembersOpen(false)}
      />
    </>
  );
}
