import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGroqApiKey } from "./groq-coach"
import { getGeminiApiKey } from "./gemini-timetable"
import {
  TIMETABLE_TEXT_PARSE_SYSTEM,
  TIMETABLE_TEXT_PARSE_USER,
} from "./prompts"
import {
  parseTimetableResultSchema,
  type ParseTimetableResult,
} from "./schemas"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile"

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain JSON")
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

async function parseWithGemini(text: string): Promise<ParseTimetableResult> {
  const key = getGeminiApiKey()
  if (!key) throw new Error("GEMINI_API_KEY missing")
  const modelName =
    process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: TIMETABLE_TEXT_PARSE_SYSTEM,
  })
  const result = await model.generateContent(
    `${TIMETABLE_TEXT_PARSE_USER}\n\n---\n${text.slice(0, 24000)}`,
  )
  const raw = result.response.text()
  const parsed = extractJsonObject(raw)
  const validated = parseTimetableResultSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`Gemini text parse invalid: ${validated.error.message}`)
  }
  return validated.data
}

async function parseWithGroq(text: string): Promise<ParseTimetableResult> {
  const key = getGroqApiKey()
  if (!key) throw new Error("GROQ_API_KEY missing")
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: TIMETABLE_TEXT_PARSE_SYSTEM },
        {
          role: "user",
          content: `${TIMETABLE_TEXT_PARSE_USER}\n\n---\n${text.slice(0, 24000)}`,
        },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Groq text parse failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ""
  const parsed = extractJsonObject(content)
  const validated = parseTimetableResultSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`Groq text parse invalid: ${validated.error.message}`)
  }
  return validated.data
}

export type TextParseSuccess = ParseTimetableResult & {
  provider: "gemini" | "groq"
}

/** Prefer Gemini, fall back to Groq when keys exist. */
export async function parseTimetablePlainText(
  text: string,
): Promise<TextParseSuccess> {
  const trimmed = text.trim()
  if (trimmed.length < 20) {
    throw new Error("Text too short to parse as a timetable")
  }

  const geminiKey = getGeminiApiKey()
  const groqKey = getGroqApiKey()
  if (!geminiKey && !groqKey) {
    throw new Error(
      "No AI keys configured. Set GEMINI_API_KEY or GROQ_API_KEY, or use CSV/Excel.",
    )
  }

  if (geminiKey) {
    try {
      const data = await parseWithGemini(trimmed)
      return { ...data, provider: "gemini" }
    } catch (e) {
      if (!groqKey) throw e
    }
  }

  const data = await parseWithGroq(trimmed)
  return { ...data, provider: "groq" }
}
