import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { deleteGroupMessage, GroupError } from "@/lib/groups/server";

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

/** DELETE /api/groups/[id]/messages/[messageId] — hard-delete (author or admin). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  if (!isSupabaseConfigured()) return unavailable();

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id, messageId } = await params;
  try {
    const result = await deleteGroupMessage(id, messageId, userId);
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof GroupError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not delete message";
    return NextResponse.json({ error: message }, { status });
  }
}
