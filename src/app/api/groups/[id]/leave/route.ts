import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { GroupError, leaveGroup } from "@/lib/groups/server";

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

/** POST /api/groups/[id]/leave — leave a group. Sole admin is blocked (409). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    const result = await leaveGroup(id, userId);
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not leave group";
    return NextResponse.json({ error: message }, { status });
  }
}
