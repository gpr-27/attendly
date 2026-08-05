import { NextResponse } from "next/server"
import {
  parseTimetablePlainText,
} from "@/lib/ai/parse-timetable-text"
import { getGeminiApiKey } from "@/lib/ai/gemini-timetable"
import { getGroqApiKey } from "@/lib/ai/groq-coach"

export const runtime = "nodejs"

type Body = {
  text?: string
}

export async function POST(request: Request) {
  if (!getGeminiApiKey() && !getGroqApiKey()) {
    return NextResponse.json(
      {
        error:
          "AI text parse needs GEMINI_API_KEY or GROQ_API_KEY. Use CSV/Excel import without keys.",
      },
      { status: 500 },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json(
      { error: 'Provide "text" with timetable content' },
      { status: 400 },
    )
  }

  try {
    const result = await parseTimetablePlainText(text)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
