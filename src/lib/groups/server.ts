/**
 * Server-only group helpers (service-role Supabase client).
 *
 * Every function takes `clerkUserId` explicitly from the caller (a Route
 * Handler that already resolved it via `auth()`) — never trust a client-
 * supplied id. Mirrors the identity pattern documented in
 * src/lib/supabase/clerk-identity.ts.
 */
import { clerkClient } from "@clerk/nextjs/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type GroupMessageRow = Database["public"]["Tables"]["group_messages"]["Row"];
import {
  groupFromRow,
  groupMemberFromRow,
  groupMessageFromRow,
} from "./mappers";
import type {
  CreateGroupInput,
  Group,
  GroupDetail,
  GroupListResult,
  GroupMessage,
  GroupRole,
} from "./types";
import {
  buildGroupSlug,
  clampPage,
  clampPageSize,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
  escapeIlikePattern,
  normalizeSearchQuery,
  validateGroupDescription,
  validateGroupName,
  validateInstitution,
  validateMessageBody,
} from "./validation";

export class GroupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GroupError";
    this.status = status;
  }
}

/**
 * Best-effort Clerk display names for chat senders. Never throws — a lookup
 * failure just falls back to no name (client shows a generic "Member" label).
 */
async function resolveSenderNames(
  clerkUserIds: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(clerkUserIds)).slice(0, 100);
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ userId: unique, limit: 100 });
    for (const user of data) {
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.username ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        null;
      if (name) names.set(user.id, name);
    }
  } catch {
    // Clerk lookup is a display-only nicety — never block chat on it.
  }
  return names;
}

function randomSlugSuffix(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return uuid.replace(/-/g, "").slice(0, 8);
}

/** List/search public groups. `q` matches name (case-insensitive substring). */
export async function searchGroups(params: {
  q?: string | null;
  page?: unknown;
  pageSize?: unknown;
}): Promise<GroupListResult> {
  const sb = getSupabaseAdmin();
  const q = normalizeSearchQuery(params.q);
  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("groups")
    .select("*", { count: "exact" })
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.length > 0) {
    query = query.ilike("name", `%${escapeIlikePattern(q)}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new GroupError(`Group search failed: ${error.message}`, 500);

  const groups = (data ?? []).map(groupFromRow);
  const total = count ?? groups.length;
  return {
    groups,
    page,
    pageSize,
    total,
    hasMore: from + groups.length < total,
  };
}

/** Create a public group. Creator is auto-joined as admin. */
export async function createGroup(
  clerkUserId: string,
  input: CreateGroupInput,
): Promise<Group> {
  const name = (input.name ?? "").trim();
  const description = (input.description ?? "").trim();
  const institution = input.institution?.trim() || null;

  const nameCheck = validateGroupName(name);
  if (!nameCheck.ok) throw new GroupError(nameCheck.error, 400);
  const descCheck = validateGroupDescription(description);
  if (!descCheck.ok) throw new GroupError(descCheck.error, 400);
  if (institution) {
    const instCheck = validateInstitution(institution);
    if (!instCheck.ok) throw new GroupError(instCheck.error, 400);
  }

  const sb = getSupabaseAdmin();

  // Slug collisions are rare (random suffix) but retry a few times to be safe.
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = buildGroupSlug(name, randomSlugSuffix());
    const insertRow = {
      name,
      slug,
      description,
      institution,
      created_by: clerkUserId,
      is_public: true,
    };
    const { error } = await sb.from("groups").insert(insertRow as never);
    if (!error) {
      const { data, error: selectError } = await sb
        .from("groups")
        .select("*")
        .eq("slug", slug)
        .single<GroupRow>();
      if (selectError || !data) {
        throw new GroupError(
          `Group created but could not reload: ${selectError?.message ?? "missing row"}`,
          500,
        );
      }
      const { error: memberError } = await sb.from("group_members").insert({
        group_id: data.id,
        clerk_user_id: clerkUserId,
        role: "admin",
      } as never);
      if (memberError && memberError.code !== "23505") {
        throw new GroupError(
          `Group created but admin membership failed: ${memberError.message}`,
          500,
        );
      }
      return groupFromRow({ ...data, member_count: 1 });
    }

    if (error.code === "23505") {
      lastError = error.message;
      continue; // slug collision — retry with a new suffix
    }
    throw new GroupError(`Could not create group: ${error.message}`, 500);
  }

  throw new GroupError(
    `Could not create group after retries: ${lastError ?? "unknown error"}`,
    500,
  );
}

async function getMembershipRole(
  groupId: string,
  clerkUserId: string,
): Promise<GroupRole | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle<{ role: GroupMemberRow["role"] }>();
  if (error) throw new GroupError(`Membership lookup failed: ${error.message}`, 500);
  return (data?.role as GroupRole | undefined) ?? null;
}

/** Group detail + the requesting user's membership state. Null if not found. */
export async function getGroupDetail(
  groupId: string,
  clerkUserId: string,
): Promise<GroupDetail | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new GroupError(`Group lookup failed: ${error.message}`, 500);
  if (!data) return null;

  const myRole = await getMembershipRole(groupId, clerkUserId);
  return {
    ...groupFromRow(data),
    isMember: myRole !== null,
    myRole,
  };
}

/** Join a public group. Idempotent — joining twice is a no-op. */
export async function joinGroup(
  groupId: string,
  clerkUserId: string,
): Promise<{ alreadyMember: boolean; group: Group }> {
  const sb = getSupabaseAdmin();
  const { data: group, error: groupError } = await sb
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle<GroupRow>();
  if (groupError) throw new GroupError(`Group lookup failed: ${groupError.message}`, 500);
  if (!group) throw new GroupError("Group not found.", 404);
  if (!group.is_public) throw new GroupError("This group is not open to joining.", 403);

  const existingRole = await getMembershipRole(groupId, clerkUserId);
  if (existingRole) {
    return { alreadyMember: true, group: groupFromRow(group) };
  }

  const { error: insertError } = await sb.from("group_members").insert({
    group_id: groupId,
    clerk_user_id: clerkUserId,
    role: "member",
  } as never);
  if (insertError && insertError.code !== "23505") {
    throw new GroupError(`Could not join group: ${insertError.message}`, 500);
  }

  const { data: updated } = await sb
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle<GroupRow>();
  return {
    alreadyMember: false,
    group: groupFromRow(updated ?? { ...group, member_count: group.member_count + 1 }),
  };
}

/** Leave a group. The sole admin cannot leave (must delete or promote someone else). */
export async function leaveGroup(
  groupId: string,
  clerkUserId: string,
): Promise<{ left: boolean }> {
  const sb = getSupabaseAdmin();
  const role = await getMembershipRole(groupId, clerkUserId);
  if (!role) return { left: false };

  if (role === "admin") {
    const { count, error: countError } = await sb
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("role", "admin");
    if (countError) {
      throw new GroupError(`Admin count check failed: ${countError.message}`, 500);
    }
    if ((count ?? 0) <= 1) {
      throw new GroupError(
        "You're the only admin. Promote another member or delete the group instead of leaving.",
        409,
      );
    }
  }

  const { error } = await sb
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("clerk_user_id", clerkUserId);
  if (error) throw new GroupError(`Could not leave group: ${error.message}`, 500);
  return { left: true };
}

/**
 * List messages for a group. Caller must already be a member.
 *
 * - `before` (pagination, loading older history): returns up to `limit`
 *   messages older than the cursor, oldest→newest.
 * - `after` (polling for new messages): returns all messages newer than the
 *   cursor, oldest→newest, uncapped by `hasMore` (chat volume is low by design).
 */
export async function listGroupMessages(
  groupId: string,
  clerkUserId: string,
  params: { before?: string | null; after?: string | null; limit?: unknown } = {},
): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  const role = await getMembershipRole(groupId, clerkUserId);
  if (!role) throw new GroupError("Join this group to view its chat.", 403);

  const sb = getSupabaseAdmin();
  const limit = clampPageSize(
    params.limit,
    DEFAULT_MESSAGE_PAGE_SIZE,
    MAX_MESSAGE_PAGE_SIZE,
  );

  if (params.after) {
    const { data, error } = await sb
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .gt("created_at", params.after)
      .order("created_at", { ascending: true })
      .limit(MAX_MESSAGE_PAGE_SIZE)
      .returns<GroupMessageRow[]>();
    if (error) throw new GroupError(`Could not load messages: ${error.message}`, 500);
    const rows = data ?? [];
    const names = await resolveSenderNames(rows.map((r) => r.clerk_user_id));
    const messages = rows.map((row) => ({
      ...groupMessageFromRow(row),
      senderName: names.get(row.clerk_user_id) ?? null,
    }));
    return { messages, hasMore: false };
  }

  let query = sb
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (params.before) {
    query = query.lt("created_at", params.before);
  }

  const { data, error } = await query.returns<GroupMessageRow[]>();
  if (error) throw new GroupError(`Could not load messages: ${error.message}`, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const names = await resolveSenderNames(page.map((r) => r.clerk_user_id));
  const messages = page
    .map((row) => ({
      ...groupMessageFromRow(row),
      senderName: names.get(row.clerk_user_id) ?? null,
    }))
    .reverse();
  return { messages, hasMore };
}

/** Send a chat message. Caller must already be a member. */
export async function sendGroupMessage(
  groupId: string,
  clerkUserId: string,
  body: string,
): Promise<GroupMessage> {
  const role = await getMembershipRole(groupId, clerkUserId);
  if (!role) throw new GroupError("Join this group to send messages.", 403);

  const trimmed = body.trim();
  const check = validateMessageBody(trimmed);
  if (!check.ok) throw new GroupError(check.error, 400);

  const sb = getSupabaseAdmin();
  const insertRow = {
    group_id: groupId,
    clerk_user_id: clerkUserId,
    body: trimmed,
  };
  const { error: insertError } = await sb
    .from("group_messages")
    .insert(insertRow as never);
  if (insertError) {
    throw new GroupError(`Could not send message: ${insertError.message}`, 500);
  }

  const { data, error } = await sb
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .eq("clerk_user_id", clerkUserId)
    .eq("body", trimmed)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GroupMessageRow>();
  if (error || !data) {
    throw new GroupError(`Could not send message: ${error?.message}`, 500);
  }
  const names = await resolveSenderNames([clerkUserId]);
  return {
    ...groupMessageFromRow(data),
    senderName: names.get(clerkUserId) ?? null,
  };
}

export { groupMemberFromRow };
