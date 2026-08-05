import { NextResponse } from "next/server";

import { missingKeyPayload } from "@/lib/ai/ai-status";
import {
  CoachAiError,
  COACH_RATE_LIMIT_MESSAGE,
  getGroqApiKey,
  runCoach,
} from "@/lib/ai/groq-coach";
import { coachRequestSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json(missingKeyPayload("GROQ_API_KEY"), {
      status: 503,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await runCoach({
      apiKey,
      stats: parsed.data.stats,
      message: parsed.data.message,
      mode: parsed.data.mode,
      voiceStyle: parsed.data.voiceStyle,
      policyResearch: parsed.data.policyResearch,
      pageContext: parsed.data.pageContext,
      allowActions: parsed.data.allowActions,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CoachAiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    const raw = err instanceof Error ? err.message : "Coach request failed";
    const rateLimited = /429|rate_limit|tokens per day|TPD/i.test(raw);
    return NextResponse.json(
      {
        error: rateLimited
          ? COACH_RATE_LIMIT_MESSAGE
          : "Coach couldn’t answer right now. Try again in a moment — bunk math and guided chips still work offline.",
        code: rateLimited ? "rate_limited" : "provider_error",
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}
