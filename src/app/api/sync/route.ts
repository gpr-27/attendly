import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { ensureClerkUserProfile } from "@/lib/supabase/clerk-identity";
import {
  isValidCloudSnapshot,
  snapshotHasData,
} from "@/lib/supabase/snapshot";
import {
  pullCloudSnapshot,
  pushCloudSnapshot,
} from "@/lib/supabase/sync-server";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function unavailable() {
  return NextResponse.json(
    { error: "Cloud sync is not configured" },
    { status: 503 },
  );
}

/**
 * Resolve tenant from Clerk session only.
 * Never accept clerk_user_id / userId from query, headers, or body.
 */
async function requireClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/** GET — ensure profile + pull cloud snapshot for the signed-in Clerk user. */
export async function GET() {
  if (!isSupabaseConfigured()) return unavailable();

  const userId = await requireClerkUserId();
  if (!userId) return unauthorized();

  try {
    const profile = await ensureClerkUserProfile(userId);
    const snapshot = await pullCloudSnapshot(userId);
    return NextResponse.json({
      ok: true,
      clerkUserId: userId,
      profileCreated: profile.created,
      hasData: snapshotHasData(snapshot),
      snapshot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pull failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT — replace cloud rows for the signed-in Clerk user only. */
export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) return unavailable();

  const userId = await requireClerkUserId();
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reject client-supplied identity fields — tenant comes only from auth().
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (
      "clerk_user_id" in o ||
      "clerkUserId" in o ||
      "userId" in o ||
      (o.snapshot &&
        typeof o.snapshot === "object" &&
        o.snapshot !== null &&
        ("clerk_user_id" in (o.snapshot as object) ||
          "clerkUserId" in (o.snapshot as object) ||
          "userId" in (o.snapshot as object)))
    ) {
      return NextResponse.json(
        {
          error:
            "Do not send clerk_user_id / userId — identity is taken from your Clerk session.",
        },
        { status: 400 },
      );
    }
  }

  const snapshot =
    body &&
    typeof body === "object" &&
    "snapshot" in body &&
    isValidCloudSnapshot((body as { snapshot: unknown }).snapshot)
      ? (body as { snapshot: Parameters<typeof pushCloudSnapshot>[1] }).snapshot
      : isValidCloudSnapshot(body)
        ? body
        : null;

  if (!snapshot) {
    return NextResponse.json(
      { error: "Body must be a CloudSnapshot or { snapshot }" },
      { status: 400 },
    );
  }

  try {
    await ensureClerkUserProfile(userId);
    await pushCloudSnapshot(userId, snapshot);
    return NextResponse.json({ ok: true, clerkUserId: userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
