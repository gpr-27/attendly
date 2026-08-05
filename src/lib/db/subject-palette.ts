/** Fixed subject color palette — traffic-light UI stays separate. */
export const SUBJECT_PALETTE = [
  "#0D9488", // teal
  "#2563EB", // blue
  "#DB2777", // pink
  "#CA8A04", // gold
  "#7C3AED", // violet (muted; not brand purple wash)
  "#EA580C", // orange
  "#059669", // emerald
  "#0284C7", // sky
  "#BE123C", // rose
  "#4F46E5", // indigo
] as const;

export function colorForIndex(index: number): string {
  return SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
}
