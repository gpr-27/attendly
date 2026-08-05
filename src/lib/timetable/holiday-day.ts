import {
  addCalendarBlock,
  clearAttendance,
  listCalendarBlocks,
  listSessionsInRange,
  type CalendarBlock,
} from "@/lib/db";
import { dayBoundsIso } from "@/lib/dates";
import { ensureSessionsMaterialized } from "./ensure-materialized";

function isDateInBlock(date: string, block: CalendarBlock): boolean {
  return date >= block.startsOn && date <= block.endsOn;
}

/** True when a suppressing exam/holiday/break block covers this local date. */
export async function isTeachingSuppressedOn(date: string): Promise<boolean> {
  const blocks = await listCalendarBlocks();
  return blocks.some((b) => b.suppressesTeaching && isDateInBlock(date, b));
}

/**
 * Mark a single local calendar day as a holiday blackout.
 * Persists a calendarBlocks row, clears marks that day, rematerializes.
 */
export async function markDateAsHoliday(
  date: string,
  title = "Holiday",
): Promise<CalendarBlock> {
  const blocks = await listCalendarBlocks();
  const existing = blocks.find(
    (b) =>
      b.kind === "holiday" &&
      b.startsOn === date &&
      b.endsOn === date &&
      b.suppressesTeaching,
  );

  let block = existing;
  if (!block) {
    block = await addCalendarBlock({
      kind: "holiday",
      title,
      startsOn: date,
      endsOn: date,
      suppressesTeaching: true,
    });
  }

  const { fromIso, toIso } = dayBoundsIso(date);
  const sessions = await listSessionsInRange(fromIso, toIso);
  for (const session of sessions) {
    await clearAttendance(session.id);
  }

  await ensureSessionsMaterialized({ from: date, to: date });
  return block;
}

/**
 * Remove one-day holiday blackouts that exactly match `date`, then rematerialize.
 * Leaves multi-day exam/break ranges alone.
 */
export async function clearOneDayHoliday(date: string): Promise<number> {
  const { deleteCalendarBlock } = await import("@/lib/db");
  const blocks = await listCalendarBlocks();
  const matches = blocks.filter(
    (b) =>
      b.kind === "holiday" &&
      b.startsOn === date &&
      b.endsOn === date &&
      b.suppressesTeaching,
  );
  for (const block of matches) {
    await deleteCalendarBlock(block.id);
  }
  if (matches.length > 0) {
    await ensureSessionsMaterialized({ from: date, to: date });
  }
  return matches.length;
}
