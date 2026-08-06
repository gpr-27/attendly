/**
 * Dexie needs IndexedDB. fake-indexeddb provides it in Node.
 * Loaded once for all suites via vitest setupFiles.
 */
import "fake-indexeddb/auto";
import { beforeEach, vi } from "vitest";
import { bindDatabaseForUser } from "@/lib/db/database";
import { resetCloudSyncState } from "@/lib/db/cloud-sync";

const originalFetch: typeof fetch | undefined = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : undefined;

function createDefaultFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/api/sync")) {
      if ((init?.method ?? "GET").toUpperCase() === "GET") {
        return new Response(
          JSON.stringify({
            ok: true,
            hasData: false,
            snapshot: {
              settings: null,
              subjects: [],
              timetableSeries: [],
              seriesExceptions: [],
              calendarBlocks: [],
              classSessions: [],
              attendanceRecords: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (originalFetch) return originalFetch(input, init);
    throw new Error(`Unexpected fetch in tests: ${url}`);
  });
}

/** Restore the default /api/sync mock after tests override fetch. */
export function restoreTestFetch(): void {
  vi.stubGlobal("fetch", createDefaultFetchMock());
}

restoreTestFetch();

/** Per-test Clerk-user Dexie bind (export/import require getBoundUserId()). */
beforeEach(async () => {
  resetCloudSyncState();
  restoreTestFetch();
  await bindDatabaseForUser("user_test_vitest");
});
