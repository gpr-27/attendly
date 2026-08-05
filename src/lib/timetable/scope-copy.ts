/**
 * Sitewide edit-scope language for Today / Timetable / Agent.
 * Always offer these two options with this exact wording.
 */
export type EditScopeValue = "this_date" | "entire_pattern";

export const SCOPE_THIS_DATE = {
  value: "this_date" as const,
  label: "This date only",
  hint: "Original weekly timetable stays the same. Next week still follows the permanent schedule.",
};

export const SCOPE_EVERY_WEEK = {
  value: "entire_pattern" as const,
  label: "Every week (permanent)",
  hint: "Changes the original repeating slot for every week — same as editing the permanent timetable.",
};

export const EDIT_SCOPE_OPTIONS = [SCOPE_THIS_DATE, SCOPE_EVERY_WEEK] as const;
