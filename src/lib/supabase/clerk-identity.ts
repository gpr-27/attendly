/**
 * Clerk ↔ Supabase identity (Attendly v1)
 *
 * Model: **server-only link** — not Supabase Auth sign-in, not client-trusted user ids.
 *
 * 1. Clerk is the only identity provider (sign-in / JWT / session cookies).
 * 2. Next.js Route Handlers call `auth()` from `@clerk/nextjs/server` and take
 *    `userId` as the tenant key (`clerk_user_id` on every cloud row).
 * 3. Supabase is accessed with the **service role** key on the server only.
 *    RLS is enabled with no anon/authenticated policies — the Data API cannot
 *    read/write tables without the service role. Defense in depth: every query
 *    still filters `.eq("clerk_user_id", userId)` from Clerk, never from the body.
 * 4. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`. Clients call
 *    `/api/sync` with the Clerk session cookie; the server resolves identity.
 * 5. Dexie DB name `AttendlyDB_u_<clerkUserId>` matches the same tenant key.
 *
 * Future (optional): Clerk JWT template + Supabase third-party auth so RLS can
 * use `auth.jwt()->>'sub'`. Not required for v1 while service-role + auth() is used.
 */

import { defaultSettings } from "@/lib/db/types";

import { getSupabaseAdmin } from "./admin";
import { settingsToRow } from "./mappers";

/**
 * Ensure a `settings` row exists for this Clerk user (first sign-in / first sync).
 * Idempotent — does not overwrite an existing cloud settings row.
 */
export async function ensureClerkUserProfile(clerkUserId: string): Promise<{
  created: boolean;
}> {
  if (!clerkUserId) {
    throw new Error("ensureClerkUserProfile: missing clerkUserId");
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("settings")
    .select("clerk_user_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }
  if (data) return { created: false };

  const defaults = defaultSettings();
  defaults.onboarded = false;
  defaults.updatedAt = new Date().toISOString();
  const row = settingsToRow(clerkUserId, defaults);
  const { error: insertError } = await sb.from("settings").insert(row as never);
  if (insertError) {
    // Race: another request created the row — treat as ok.
    if (insertError.code === "23505") return { created: false };
    throw new Error(`Profile create failed: ${insertError.message}`);
  }
  return { created: true };
}
