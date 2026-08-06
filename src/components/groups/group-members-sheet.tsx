"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { Shield, User, X } from "lucide-react";
import type { GroupMember } from "@/lib/groups/types";
import { cn } from "@/lib/utils/cn";

type GroupMembersSheetProps = {
  open: boolean;
  groupName: string;
  members: GroupMember[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function memberLabel(member: GroupMember, currentUserId: string | null | undefined): string {
  if (member.clerkUserId === currentUserId) return "You";
  return (
    member.displayName ??
    `Member ${member.clerkUserId.slice(-4)}`
  );
}

export function GroupMembersSheet({
  open,
  groupName,
  members,
  loading,
  error,
  onClose,
}: GroupMembersSheetProps) {
  const { userId } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal
      aria-labelledby="group-members-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="Close members list"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl sm:inset-x-3 sm:bottom-auto sm:top-[10%] sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:rounded-2xl">
        <div className="shrink-0 border-b border-line px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
                Members
              </p>
              <h2
                id="group-members-title"
                className="font-display mt-0.5 text-lg font-semibold leading-snug text-ink"
              >
                {groupName}
              </h2>
              <p className="mt-0.5 text-sm text-mute">
                {loading
                  ? "Loading…"
                  : `${members.length} member${members.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-mist hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p className="rounded-xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
              {error}
            </p>
          ) : loading ? (
            <p className="text-sm text-mute">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-mute">No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const mine = member.clerkUserId === userId;
                const label = memberLabel(member, userId);
                return (
                  <li
                    key={member.clerkUserId}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-line/60",
                      mine ? "bg-brand/5" : "bg-surface-raised",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        member.role === "admin"
                          ? "bg-brand/15 text-brand"
                          : "bg-mist text-mute",
                      )}
                      aria-hidden
                    >
                      {member.role === "admin" ? (
                        <Shield className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{label}</p>
                      <p className="text-xs text-mute">
                        Joined {formatJoined(member.joinedAt)}
                        {member.role === "admin" ? " · Admin" : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
