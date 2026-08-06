"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { syncAfterBind, registerCloudPushLifecycle } from "@/lib/db/cloud-sync";
import { bindDatabaseForUser } from "@/lib/db/database";

/**
 * Binds Dexie to `AttendlyDB_u_<clerkUserId>`, then pulls from Supabase
 * (cloud-first merge into Dexie cache). Remounts on account switch.
 */
export function UserDatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registerCloudPushLifecycle();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      setReadyFor(null);
      setError(null);
      return;
    }

    setError(null);
    void bindDatabaseForUser(userId)
      .then(async () => {
        // Best-effort cloud sync; Dexie still usable offline if sync fails.
        try {
          await syncAfterBind();
        } catch {
          /* keep local cache */
        }
        if (!cancelled) setReadyFor(userId);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReadyFor(null);
          setError(err instanceof Error ? err.message : "Database failed to open");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-mute">
        Loading…
      </div>
    );
  }

  if (!isSignedIn || !userId) {
    return <>{children}</>;
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
        <p className="font-display text-lg text-ink">Couldn’t open your data</p>
        <p className="max-w-sm text-sm text-mute">{error}</p>
      </div>
    );
  }

  if (readyFor !== userId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-mute">
        Opening your attendance…
      </div>
    );
  }

  return <div key={userId}>{children}</div>;
}
