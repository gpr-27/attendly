/**
 * Public searchable groups + join + group chat (Attendly v1).
 *
 * Chat-only social layer: groups never carry personal attendance data.
 * `clerkUserId` fields are always the Clerk session `userId` — never a
 * client-trusted value (see src/lib/supabase/clerk-identity.ts for the
 * identity pattern this follows).
 */

export type GroupRole = "member" | "admin";

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  institution: string | null;
  createdBy: string;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Group + the requesting user's membership state — used by group detail. */
export interface GroupDetail extends Group {
  isMember: boolean;
  myRole: GroupRole | null;
}

export interface GroupMember {
  groupId: string;
  clerkUserId: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  clerkUserId: string;
  body: string;
  createdAt: string;
  /** Best-effort display name resolved server-side from Clerk. Never guaranteed. */
  senderName?: string | null;
}

export interface GroupListResult {
  groups: Group[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  institution?: string | null;
}
