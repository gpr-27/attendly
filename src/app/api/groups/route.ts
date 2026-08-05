import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createGroup, GroupError, searchGroups } from "@/lib/groups/server";

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

/** GET /api/groups?q=&page=&pageSize= — search/list public groups. Signed-in only. */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { searchParams } = request.nextUrl;
  try {
    const result = await searchGroups({
      q: searchParams.get("q"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Group search failed";
    return NextResponse.json({ error: message }, { status });
  }
}

/** POST /api/groups — create a public group. Creator becomes admin. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  if (typeof o.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const group = await createGroup(userId, {
      name: o.name,
      description: typeof o.description === "string" ? o.description : undefined,
      institution: typeof o.institution === "string" ? o.institution : undefined,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not create group";
    return NextResponse.json({ error: message }, { status });
  }
}
