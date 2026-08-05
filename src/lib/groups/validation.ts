/**
 * Pure validation + formatting helpers for groups (no I/O — unit testable).
 */

export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 500;
export const GROUP_INSTITUTION_MAX = 120;
export const MESSAGE_BODY_MAX = 2000;
export const SEARCH_QUERY_MAX = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateGroupName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < GROUP_NAME_MIN) {
    return {
      ok: false,
      error: `Group name must be at least ${GROUP_NAME_MIN} characters.`,
    };
  }
  if (trimmed.length > GROUP_NAME_MAX) {
    return {
      ok: false,
      error: `Group name must be ${GROUP_NAME_MAX} characters or fewer.`,
    };
  }
  return { ok: true };
}

export function validateGroupDescription(description: string): ValidationResult {
  if (description.length > GROUP_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be ${GROUP_DESCRIPTION_MAX} characters or fewer.`,
    };
  }
  return { ok: true };
}

export function validateInstitution(institution: string): ValidationResult {
  if (institution.length > GROUP_INSTITUTION_MAX) {
    return {
      ok: false,
      error: `Institution must be ${GROUP_INSTITUTION_MAX} characters or fewer.`,
    };
  }
  return { ok: true };
}

export function validateMessageBody(body: string): ValidationResult {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Message can't be empty." };
  }
  if (trimmed.length > MESSAGE_BODY_MAX) {
    return {
      ok: false,
      error: `Message must be ${MESSAGE_BODY_MAX} characters or fewer.`,
    };
  }
  return { ok: true };
}

/** Lowercase, hyphenated, ASCII-safe base for a group URL slug. Never empty. */
export function slugifyGroupName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "group";
}

/** Deterministic given (name, suffix) — caller supplies a random/unique suffix. */
export function buildGroupSlug(name: string, uniqueSuffix: string): string {
  const base = slugifyGroupName(name).slice(0, 60);
  return `${base}-${uniqueSuffix}`;
}

export function normalizeSearchQuery(q: string | null | undefined): string {
  return (q ?? "").trim().slice(0, SEARCH_QUERY_MAX);
}

/** ILIKE-safe wildcard escape (defends against user-supplied `%` / `_`). */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export function clampPage(page: unknown): number {
  const n = typeof page === "string" ? Number(page) : page;
  return Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 1;
}

export function clampPageSize(
  pageSize: unknown,
  fallback: number = DEFAULT_PAGE_SIZE,
  max: number = MAX_PAGE_SIZE,
): number {
  const n = typeof pageSize === "string" ? Number(pageSize) : pageSize;
  const raw = Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : fallback;
  return Math.min(Math.max(raw, 1), max);
}
