import * as XLSX from "xlsx"
import type { ParseTimetableResult } from "@/lib/ai/schemas"
import { parseTimetableRows } from "./parse-tabular"

/** Parse .xlsx / .xls ArrayBuffer via SheetJS into preview shape. */
export function parseTimetableExcel(buffer: ArrayBuffer): ParseTimetableResult {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Excel file has no sheets")
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error("Excel sheet is empty")
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][]
  const normalized = rows.map((r) =>
    (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim()),
  )
  return parseTimetableRows(normalized)
}
