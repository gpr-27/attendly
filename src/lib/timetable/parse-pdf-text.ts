/**
 * Best-effort text extraction from a text-based PDF (no images).
 * Scans content streams for literal strings — enough for simple portal exports.
 * Messy / scanned PDFs should go through the AI text parse API.
 */
export function extractPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let raw = ""
  // Prefer latin1 so binary stays 1:1 with byte values for regex scanning
  if (typeof TextDecoder !== "undefined") {
    raw = new TextDecoder("latin1").decode(bytes)
  } else {
    raw = Array.from(bytes, (b) => String.fromCharCode(b)).join("")
  }

  const chunks: string[] = []
  const parenRe = /\((?:\\.|[^\\)])*\)/g
  const hexRe = /<([0-9A-Fa-f\s]+)>/g

  let match: RegExpExecArray | null
  while ((match = parenRe.exec(raw)) !== null) {
    const inner = match[0].slice(1, -1)
    const decoded = inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{1,3})/g, (_, oct: string) =>
        String.fromCharCode(parseInt(oct, 8)),
      )
    if (decoded.trim()) chunks.push(decoded)
  }

  while ((match = hexRe.exec(raw)) !== null) {
    const hex = match[1]!.replace(/\s+/g, "")
    if (hex.length < 2 || hex.length % 2 !== 0) continue
    let s = ""
    for (let i = 0; i < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
    }
    if (/[\x20-\x7E]{2,}/.test(s)) chunks.push(s)
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim()
}

/** Heuristic: does extracted text look like it might contain a timetable? */
export function pdfTextLooksUseful(text: string): boolean {
  if (text.length < 40) return false
  const lower = text.toLowerCase()
  const dayHit =
    /\b(mon|tue|wed|thu|fri|sat|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(
      lower,
    )
  const timeHit = /\b\d{1,2}[:.]\d{2}\b/.test(text)
  return dayHit && timeHit
}
