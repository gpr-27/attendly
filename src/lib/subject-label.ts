/**
 * Display helpers — prefer full subject name in UI.
 * shortCode stays in the data model; show it muted/secondary when useful.
 */

export function subjectPrimaryLabel(input: {
  name?: string | null;
  shortCode?: string | null;
}): string {
  const name = input.name?.trim();
  if (name) return name;
  return input.shortCode?.trim() || "Subject";
}

/** Compact secondary line — code only when it adds info beyond the name. */
export function subjectSecondaryCode(input: {
  name?: string | null;
  shortCode?: string | null;
}): string | null {
  const code = input.shortCode?.trim();
  if (!code) return null;
  const name = input.name?.trim();
  if (!name) return null;
  if (name.toLowerCase() === code.toLowerCase()) return null;
  return code;
}

/** Dialog / toast label: Name (CODE) or just Name. */
export function subjectDialogLabel(input: {
  name?: string | null;
  shortCode?: string | null;
}): string {
  const primary = subjectPrimaryLabel(input);
  const code = subjectSecondaryCode(input);
  return code ? `${primary} (${code})` : primary;
}
