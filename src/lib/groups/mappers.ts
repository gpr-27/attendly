import type { Database } from "@/lib/supabase/database.types";
import type { Group, GroupMember, GroupMessage, GroupRole } from "./types";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type GroupMessageRow = Database["public"]["Tables"]["group_messages"]["Row"];

export function groupFromRow(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    institution: row.institution,
    createdBy: row.created_by,
    isPublic: row.is_public,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function groupMemberFromRow(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    clerkUserId: row.clerk_user_id,
    role: row.role as GroupRole,
    joinedAt: row.joined_at,
  };
}

export function groupMessageFromRow(row: GroupMessageRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.group_id,
    clerkUserId: row.clerk_user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}
