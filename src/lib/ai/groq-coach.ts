import Groq from "groq-sdk";

import {
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  COACH_POLICY_RESEARCH_SYSTEM,
} from "./prompts";
import {
  extractActionsFromCoachReply,
  parseAgentActionsPayload,
} from "./actions";
import {
  coachPlanSchema,
  coachResponseSchema,
  type CoachMode,
  type CoachPlan,
  type CoachResponse,
} from "./schemas";
import { extractJsonText } from "./json-text";

/** Primary grounded chat model (env: GROQ_MODEL). */
const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
/** Faster/cheaper retry when primary hits TPD/RPM (env: GROQ_FALLBACK_MODEL). */
const DEFAULT_FALLBACK_MODEL = "llama-3.1-8b-instant";
/** Optional research model — never used for bunk % math. */
const POLICY_MODEL = "groq/compound";

export const COACH_RATE_LIMIT_MESSAGE =
  "Coach is temporarily rate-limited (tried the faster backup model too). Try again in a few minutes — bunk math and guided chips still work offline.";

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key || null;
}

export function getGroqChatModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

export function getGroqFallbackModel(): string {
  return process.env.GROQ_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
}

export class CoachAiError extends Error {
  readonly code: "rate_limited" | "provider_error";
  readonly status: number;

  constructor(
    message: string,
    options: { code: "rate_limited" | "provider_error"; status: number },
  ) {
    super(message);
    this.name = "CoachAiError";
    this.code = options.code;
    this.status = options.status;
  }
}

function extractPlanFromReply(reply: string): CoachPlan | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(reply);
  const raw = fenced?.[1]?.trim() ?? extractJsonText(reply);
  if (!raw.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const validated = coachPlanSchema.safeParse(parsed);
    return validated.success ? validated.data : undefined;
  } catch {
    return undefined;
  }
}

function stripPlanFence(reply: string): string {
  return reply
    .replace(/```(?:json)?\s*[\s\S]*?\s*```/gi, "")
    .trim();
}

/** 429 / rate_limit_exceeded / 503 — worth one fallback-model retry. */
export function isGroqModelRetryable(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (status === 429 || status === 503) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|rate_limit_exceeded|rate limit/i.test(msg);
}

async function createChatCompletion(
  client: Groq,
  model: string,
  args: {
    temperature: number;
    max_tokens: number;
    messages: Array<{ role: "system" | "user"; content: string }>;
  },
) {
  return client.chat.completions.create({
    model,
    temperature: args.temperature,
    max_tokens: args.max_tokens,
    messages: args.messages,
  });
}

/**
 * Primary model, then one retry on 429/503 with the 8B fallback.
 * Does not retry when primary and fallback ids are the same.
 */
async function createChatWithFallback(
  client: Groq,
  args: {
    temperature: number;
    max_tokens: number;
    messages: Array<{ role: "system" | "user"; content: string }>;
  },
) {
  const primary = getGroqChatModel();
  const fallback = getGroqFallbackModel();

  try {
    return await createChatCompletion(client, primary, args);
  } catch (primaryErr) {
    if (!isGroqModelRetryable(primaryErr) || fallback === primary) {
      throw primaryErr;
    }
    try {
      return await createChatCompletion(client, fallback, args);
    } catch (fallbackErr) {
      if (isGroqModelRetryable(fallbackErr)) {
        throw new CoachAiError(COACH_RATE_LIMIT_MESSAGE, {
          code: "rate_limited",
          status: 429,
        });
      }
      throw fallbackErr;
    }
  }
}

async function runPolicyResearch(options: {
  client: Groq;
  message: string;
}): Promise<string | null> {
  try {
    const completion = await options.client.chat.completions.create({
      model: POLICY_MODEL,
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: "system", content: COACH_POLICY_RESEARCH_SYSTEM },
        { role: "user", content: options.message },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch {
    // Policy research is optional — never fail the grounded coach path.
    return null;
  }
}

export async function runCoach(options: {
  apiKey: string;
  stats: Record<string, unknown>;
  message: string;
  mode?: CoachMode;
  voiceStyle?: boolean;
  policyResearch?: boolean;
  pageContext?: string;
  allowActions?: boolean;
}): Promise<CoachResponse> {
  const mode = options.mode ?? "chat";
  const voiceStyle = options.voiceStyle !== false;
  const policyResearch = options.policyResearch === true;
  const allowActions = options.allowActions === true;

  const client = new Groq({ apiKey: options.apiKey });

  let policyNote: string | null = null;
  if (policyResearch) {
    policyNote = await runPolicyResearch({
      client,
      message: options.message,
    });
  }

  const userContent = [
    buildCoachUserPrompt(
      options.stats,
      options.message,
      options.pageContext,
    ),
    policyNote
      ? [
          "",
          "Optional policy research notes (do NOT use these for % or bunk math;",
          "only for college-rule context if relevant):",
          policyNote,
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let completion;
  try {
    completion = await createChatWithFallback(client, {
      temperature: mode === "plan" ? 0.3 : allowActions ? 0.3 : 0.4,
      max_tokens: mode === "plan" || allowActions ? 1400 : 800,
      messages: [
        {
          role: "system",
          content: buildCoachSystemPrompt({ mode, voiceStyle, allowActions }),
        },
        { role: "user", content: userContent },
      ],
    });
  } catch (err) {
    if (err instanceof CoachAiError) throw err;
    if (isGroqModelRetryable(err)) {
      throw new CoachAiError(COACH_RATE_LIMIT_MESSAGE, {
        code: "rate_limited",
        status: 429,
      });
    }
    const raw = err instanceof Error ? err.message : "Coach request failed";
    // Never surface raw Groq JSON bodies to the client.
    const friendly = /rate_limit|429|tokens per day|TPD/i.test(raw)
      ? COACH_RATE_LIMIT_MESSAGE
      : "Coach couldn’t answer right now. Try again in a moment — bunk math and guided chips still work offline.";
    throw new CoachAiError(friendly, {
      code: /rate_limit|429/i.test(raw) ? "rate_limited" : "provider_error",
      status: /429|rate_limit/i.test(raw) ? 429 : 502,
    });
  }

  const rawReply = completion.choices[0]?.message?.content?.trim();
  if (!rawReply) {
    throw new CoachAiError("Groq returned an empty reply. Try again shortly.", {
      code: "provider_error",
      status: 502,
    });
  }

  let plan: CoachPlan | undefined;
  let reply = rawReply;

  if (mode === "plan") {
    plan = extractPlanFromReply(rawReply);
    const prose = stripPlanFence(rawReply);
    reply = prose || "Here’s your week plan from your stats.";
  }

  const payload: CoachResponse = {
    reply,
    mode,
    ...(plan ? { plan } : {}),
    ...(policyResearch ? { usedPolicyResearch: Boolean(policyNote) } : {}),
  };

  if (allowActions) {
    const actionsPayload =
      parseAgentActionsPayload(rawReply) ??
      extractActionsFromCoachReply(rawReply);
    payload.reply = actionsPayload.message || stripPlanFence(rawReply) || reply;
    payload.message = actionsPayload.message;
    if (actionsPayload.actions.length > 0) {
      payload.actions = actionsPayload.actions as unknown as Record<
        string,
        unknown
      >[];
    }
    if (actionsPayload.chips?.length) {
      payload.chips = actionsPayload.chips;
    }
  }

  const validated = coachResponseSchema.safeParse(payload);
  if (!validated.success) {
    throw new CoachAiError("Coach reply failed validation", {
      code: "provider_error",
      status: 502,
    });
  }

  return validated.data;
}
