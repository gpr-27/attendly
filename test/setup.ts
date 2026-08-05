/**
 * Dexie needs IndexedDB. fake-indexeddb provides it in Node.
 * Loaded once for all suites via vitest setupFiles.
 */
import "fake-indexeddb/auto";
import { beforeEach, vi } from "vitest";
import { bindDatabaseForUser } from "@/lib/db/database";

const originalFetch = globalThis.fetch?.bind(globalThis);

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
  }),
);

/** Per-test Clerk-user Dexie bind (export/import require getBoundUserId()). */
beforeEach(async () => {
  await bindDatabaseForUser("user_test_vitest");
});
