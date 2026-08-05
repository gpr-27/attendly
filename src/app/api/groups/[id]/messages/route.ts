import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  GroupError,
  listGroupMessages,
  sendGroupMessage,
} from "@/lib/groups/server";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return NextResponse.json(
    { error: "Groups are not configured (Supabase env vars missing)" },
    { status: 503 },
  );
}

/** GET /api/groups/[id]/messages — chat history. Members only. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  try {
    const result = await listGroupMessages(id, userId, {
      before: searchParams.get("before"),
      after: searchParams.get("after"),
      limit: searchParams.get("limit"),
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not load messages";
    return NextResponse.json({ error: message }, { status });
  }
}

/** POST /api/groups/[id]/messages — send a chat message. Members only. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as { body?: unknown }).body !== "string") {
    return NextResponse.json({ error: "body (string) is required" }, { status: 400 });
  }

  try {
    const message = await sendGroupMessage(id, userId, (body as { body: string }).body);
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not send message";
    return NextResponse.json({ error: message }, { status });
  }
}
