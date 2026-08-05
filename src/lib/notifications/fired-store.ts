/**
 * Persist which local notifications already fired today so refresh
 * does not re-spam the same reminder.
 */

const STORAGE_KEY = "attendly:notif-fired";

type FiredMap = Record<string, string>; // key → ISO day YYYY-MM-DD

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readMap(): FiredMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FiredMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: FiredMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Drop entries from other days. */
function prune(map: FiredMap, day: string): FiredMap {
  const next: FiredMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === day) next[k] = v;
  }
  return next;
}

export function wasNotificationFired(key: string, now = new Date()): boolean {
  const day = todayKey(now);
  const map = prune(readMap(), day);
  writeMap(map);
  return map[key] === day;
}

export function markNotificationFired(key: string, now = new Date()): void {
  const day = todayKey(now);
  const map = prune(readMap(), day);
  map[key] = day;
  writeMap(map);
}

export function preClassFireKey(sessionId: string, leadMinutes: number): string {
  return `pre:${sessionId}:${leadMinutes}`;
}

export function postClassFireKey(sessionId: string): string {
  return `post:${sessionId}`;
}

export function criticalFireKey(subjectId: string, now = new Date()): string {
  return `critical:${subjectId}:${todayKey(now)}`;
}
