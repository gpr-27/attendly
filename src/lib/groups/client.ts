/**
 * Client-side fetch wrappers for the /api/groups routes.
 * All requests rely on the Clerk session cookie for auth — no ids in the body.
 */
import type {
  Group,
  GroupDetail,
  GroupListResult,
  GroupMessage,
} from "./types";

class GroupApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GroupApiError";
    this.status = status;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) ?? `Request failed (${res.status})`;
    throw new GroupApiError(message, res.status);
  }
  return body as T;
}

export async function fetchGroups(params: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<GroupListResult> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  const res = await fetch(`/api/groups${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
  return asJson<GroupListResult>(res);
}

export async function createGroupRequest(input: {
  name: string;
  description?: string;
  institution?: string;
}): Promise<Group> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<Group>(res);
}

export async function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  const res = await fetch(`/api/groups/${groupId}`, { method: "GET" });
  return asJson<GroupDetail>(res);
}

export async function joinGroupRequest(
  groupId: string,
): Promise<{ alreadyMember: boolean; group: Group }> {
  const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
  return asJson(res);
}

export async function leaveGroupRequest(
  groupId: string,
): Promise<{ left: boolean }> {
  const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
  return asJson(res);
}

export async function fetchGroupMessages(
  groupId: string,
  params: { before?: string; after?: string; limit?: number } = {},
): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  const search = new URLSearchParams();
  if (params.before) search.set("before", params.before);
  if (params.after) search.set("after", params.after);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await fetch(`/api/groups/${groupId}/messages${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
  return asJson(res);
}

export async function sendGroupMessageRequest(
  groupId: string,
  body: string,
): Promise<GroupMessage> {
  const res = await fetch(`/api/groups/${groupId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return asJson<GroupMessage>(res);
}

export { GroupApiError };
