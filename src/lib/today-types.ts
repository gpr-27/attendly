import type { RiskBand } from "@/lib/attendance";

export type RiskLevel = "safe" | "watch" | "danger";

export type MarkStatus =
  | "unmarked"
  | "present"
  | "absent"
  | "cancelled"
  | "holiday"
  | "on_duty";

export type AgendaClass = {
  id: string;
  subjectName: string;
  shortCode: string;
  color: string;
  startLabel: string;
  endLabel: string;
  endsAtMs: number;
  /** Local YYYY-MM-DD for this occurrence. */
  ymd: string;
  /** HH:mm for move/reschedule dialogs. */
  startHm: string;
  endHm: string;
  location?: string;
  status: MarkStatus;
  /** Series id when from weekly pattern — enables permanent move. */
  seriesId?: string | null;
  /** null when this subject has no counted classes yet */
  pct: number | null;
  risk: RiskLevel | null;
  impactLine: string | null;
  /** lecture / lab / tutorial etc. from Dexie session */
  sessionType?: string;
  /** scheduled / makeup / additional */
  relevance?: string;
};

export function toRiskLevel(band: RiskBand | null): RiskLevel | null {
  if (!band) return null;
  if (band === "Safe") return "safe";
  if (band === "Warning") return "watch";
  return "danger";
}

export function mapOdPolicy(
  odCountsAs: "present" | "excused" | "neutral",
): "present" | "absent" | "exclude" {
  if (odCountsAs === "present") return "present";
  return "exclude";
}
