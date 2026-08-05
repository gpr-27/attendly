import { getGeminiApiKey } from "./gemini-timetable";
import { getGroqApiKey } from "./groq-coach";
import type { AiStatus } from "./schemas";

export const AI_SETUP_HINT =
  "Add GROQ_API_KEY and/or GEMINI_API_KEY to .env.local (or Vercel env), then restart. Bunk math, timetable, and marking still work without AI.";

export function getAiStatus(): AiStatus {
  const groqConfigured = Boolean(getGroqApiKey());
  const geminiConfigured = Boolean(getGeminiApiKey());
  const anyAiConfigured = groqConfigured || geminiConfigured;
  return {
    groqConfigured,
    geminiConfigured,
    anyAiConfigured,
    setupHint: anyAiConfigured ? undefined : AI_SETUP_HINT,
  };
}

export function missingKeyPayload(which: "GROQ_API_KEY" | "GEMINI_API_KEY") {
  return {
    error: `${which} is not set. Add it to .env.local (local) or Vercel env (deploy).`,
    code: "missing_key" as const,
    setupHint: AI_SETUP_HINT,
  };
}
