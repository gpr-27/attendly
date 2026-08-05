/**
 * Dexie needs IndexedDB. fake-indexeddb provides it in Node.
 * Loaded once for all suites via vitest setupFiles.
 */
import "fake-indexeddb/auto";
