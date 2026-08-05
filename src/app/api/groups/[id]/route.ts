import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { getGroupDetail, GroupError } from "@/lib/groups/server";

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

/** GET /api/groups/[id] — group detail + member count + current user's membership. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    const detail = await getGroupDetail(id, userId);
    if (!detail) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not load group";
    return NextResponse.json({ error: message }, { status });
  }
}
