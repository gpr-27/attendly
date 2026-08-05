export {
  materializeSessions,
  cancelSeriesOccurrence,
  modifySeriesOccurrence,
  addExtraSession,
  cancelSessionOccurrence,
  localDateTimeIso,
  type MaterializeRange,
  type MaterializeResult,
} from "./materialize-sessions"
export {
  applySeriesEdit,
  applySeriesCancel,
  type EditSeriesScope,
  type CancelSeriesScope,
  type SeriesTimePatch,
} from "./edit-series-scope"
export {
  deleteCancelledOccurrence,
  removeExtraSession,
  isRemovableExtraSession,
  moveSessionOccurrence,
  cancelSessionById,
  type MoveSessionScope,
  type MoveSessionInput,
  type MoveSessionResult,
} from "./move-session"
export {
  ensureSessionsMaterialized,
  resolveMaterializeRange,
  ensureSemesterRange,
  repairMidWeekSemesterStart,
  syncSeriesToSemesterStart,
  applySemesterRange,
} from "./ensure-materialized"
export {
  timesOverlap,
  findDaySlotOverlaps,
  assertNoOverlapForMove,
  getPeriodSlotsOccupancy,
  formatOccupancyTooltip,
  formatTakenChipLabel,
  probeDateForWeekday,
  type OverlapConflict,
  type OverlapCheckResult,
  type PeriodOccupant,
  type PeriodSlotOccupancy,
} from "./slot-overlap"
export {
  markDateAsHoliday,
  clearOneDayHoliday,
  isTeachingSuppressedOn,
} from "./holiday-day"
export { isoWeekNumber, matchesWeekParity } from "./week-parity"
export {
  getPeriodSlots,
  normalizePeriodSlots,
  resolvePeriodSlot,
  timesFromSlotIndex,
  validatePeriodSlot,
  validatePeriodSlots,
  isValidPeriodTime,
  timeToMinutes,
  matchPeriodSlotIndex,
  ensurePeriodSlotsCover,
  resolvePeriodChipsForTimes,
  isStockDefaultPeriods,
  periodSlotDisplayLabel,
  renumberPeriodSlotLabels,
} from "./period-slots"
export {
  buildSessionsIcs,
  downloadIcsFile,
  toIcsUtc,
  type IcsExportInput,
} from "./export-ics"
export { parseTimetableCsv, parseTimetableRows } from "./parse-tabular"
export { parseTimetableExcel } from "./parse-excel"
export { extractPdfText, pdfTextLooksUseful } from "./parse-pdf-text"
export {
  EDIT_SCOPE_OPTIONS,
  SCOPE_EVERY_WEEK,
  SCOPE_THIS_DATE,
  type EditScopeValue,
} from "./scope-copy"
