import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";

import { getGroqApiKey } from "./groq-coach";
import { extractJsonText } from "./json-text";
import { TIMETABLE_PARSE_SYSTEM, TIMETABLE_PARSE_USER } from "./prompts";
import {
  parseTimetableResultSchema,
  type ParseTimetableResult,
} from "./schemas";

export { extractJsonText } from "./json-text";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-flash-latest",
] as const;

const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Cap a single respect-retryDelay wait (seconds). */
const MAX_RETRY_WAIT_SEC = 50;
/** If retryDelay is larger than this, use short backoff instead. */
const HUGE_DELAY_SEC = 50;
const SHORT_BACKOFF_SEC = [2, 5] as const;
/** Max generate attempts per Gemini model (includes first try). */
const MAX_ATTEMPTS_PER_MODEL = 3;

export type ParseProvider = "gemini" | "groq";

export type ParseTimetableSuccess = ParseTimetableResult & {
  provider: ParseProvider;
};

export type TimetableAiErrorCode =
  | "quota_exceeded"
  | "provider_error"
  | "validation_error";

export class TimetableAiError extends Error {
  readonly code: TimetableAiErrorCode;
  readonly retryAfterSeconds?: number;
  readonly hint?: string;
  readonly status?: number;

  constructor(options: {
    message: string;
    code: TimetableAiErrorCode;
    retryAfterSeconds?: number;
    hint?: string;
    status?: number;
  }) {
    super(options.message);
    this.name = "TimetableAiError";
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.hint = options.hint;
    this.status = options.status;
  }
}

export type ParseTimetableDeps = {
  sleep?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
};

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

/** Prefer GEMINI_MODEL, then the default fallback chain (deduped). */
export function getGeminiModelChain(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const chain = preferred
    ? [preferred, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== preferred)]
    : [...DEFAULT_GEMINI_MODELS];
  return [...new Set(chain)];
}

/** Strip data-URL prefix if present; return raw base64 + mime. */
export function normalizeImageInput(
  rawBase64: string,
  mimeType?: string,
): { data: string; mimeType: string } {
  const dataUrl = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(
    rawBase64.trim(),
  );
  if (dataUrl) {
    return { mimeType: dataUrl[1], data: dataUrl[2] };
  }
  return {
    mimeType: mimeType?.trim() || "image/jpeg",
    data: rawBase64.replace(/\s/g, ""),
  };
}

export function validateTimetableJson(parsed: unknown): ParseTimetableResult {
  const validated = parseTimetableResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new TimetableAiError({
      code: "validation_error",
      message: `Timetable JSON failed validation: ${validated.error.issues
        .map((i) => i.message)
        .join("; ")}`,
    });
  }
  return validated.data;
}

function parseJsonFromModelText(text: string): ParseTimetableResult {
  if (!text?.trim()) {
    throw new TimetableAiError({
      code: "provider_error",
      message: "Model returned an empty response",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch {
    throw new TimetableAiError({
      code: "provider_error",
      message: "Model returned invalid JSON",
    });
  }

  return validateTimetableJson(parsed);
}

/** Parse retryDelay from Gemini error message / details (seconds). */
export function parseRetryDelaySeconds(err: unknown): number | undefined {
  const candidates: string[] = [];

  if (err instanceof Error) {
    candidates.push(err.message);
  }

  if (err instanceof GoogleGenerativeAIFetchError && err.errorDetails) {
    candidates.push(JSON.stringify(err.errorDetails));
  }

  if (err && typeof err === "object") {
    try {
      candidates.push(JSON.stringify(err));
    } catch {
      /* ignore */
    }
  }

  const blob = candidates.join("\n");

  const patterns = [
    /["']?retryDelay["']?\s*[:=]\s*["']?([\d.]+)s/i,
    /Please retry in\s*~?\s*([\d.]+)\s*s/i,
    /retry in\s*~?\s*([\d.]+)\s*s/i,
    /Retry-After["']?\s*[:=]\s*["']?([\d.]+)/i,
  ];

  for (const re of patterns) {
    const m = re.exec(blob);
    if (m) {
      const sec = Number.parseFloat(m[1]);
      if (Number.isFinite(sec) && sec >= 0) return Math.ceil(sec);
    }
  }

  return undefined;
}

export function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof GoogleGenerativeAIFetchError && typeof err.status === "number") {
    return err.status;
  }
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  if (err instanceof Error) {
    const m = /\b(429|404|403|500|503)\b/.exec(err.message);
    if (m) return Number(m[1]);
  }
  return undefined;
}

export function isQuotaOrRateLimitError(err: unknown): boolean {
  if (err instanceof TimetableAiError && err.code === "quota_exceeded") {
    return true;
  }
  const status = getHttpStatus(err);
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|too many requests|quota exceeded|rate.?limit|resource.?exhausted/i.test(
    msg,
  );
}

export function isNotFoundModelError(err: unknown): boolean {
  const status = getHttpStatus(err);
  if (status === 404) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /404|not found|is not found|not supported/i.test(msg);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitSeconds(
  seconds: number,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return sleep(ms);
}

async function generateWithGeminiModel(options: {
  apiKey: string;
  modelName: string;
  data: string;
  mimeType: string;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: options.modelName,
    systemInstruction: TIMETABLE_PARSE_SYSTEM,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    TIMETABLE_PARSE_USER,
    { inlineData: { mimeType: options.mimeType, data: options.data } },
  ]);

  return result.response.text();
}

/**
 * Try one Gemini model with limited 429 retries.
 * Honors retryDelay once (capped); uses short backoff if delay is huge.
 */
async function tryGeminiModel(options: {
  apiKey: string;
  modelName: string;
  data: string;
  mimeType: string;
  sleep: (ms: number) => Promise<void>;
}): Promise<ParseTimetableResult> {
  let honoredRetryDelay = false;
  let shortBackoffIndex = 0;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
    try {
      const text = await generateWithGeminiModel({
        apiKey: options.apiKey,
        modelName: options.modelName,
        data: options.data,
        mimeType: options.mimeType,
      });
      return parseJsonFromModelText(text);
    } catch (err) {
      lastErr = err;

      if (isNotFoundModelError(err)) {
        throw err;
      }

      if (!isQuotaOrRateLimitError(err) || attempt >= MAX_ATTEMPTS_PER_MODEL) {
        throw err;
      }

      const retryDelay = parseRetryDelaySeconds(err) ?? 5;

      if (!honoredRetryDelay && retryDelay <= HUGE_DELAY_SEC) {
        honoredRetryDelay = true;
        await waitSeconds(Math.min(retryDelay, MAX_RETRY_WAIT_SEC), options.sleep);
        continue;
      }

      // Huge delay, or already waited once — short backoff then continue / fail
      const short =
        SHORT_BACKOFF_SEC[
          Math.min(shortBackoffIndex, SHORT_BACKOFF_SEC.length - 1)
        ]!;
      shortBackoffIndex += 1;
      await waitSeconds(short, options.sleep);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Gemini request failed after retries");
}

async function parseWithGemini(options: {
  apiKey: string;
  data: string;
  mimeType: string;
  sleep: (ms: number) => Promise<void>;
}): Promise<ParseTimetableResult> {
  const models = getGeminiModelChain();
  let lastQuotaErr: unknown;
  let lastRetryAfter: number | undefined;

  for (const modelName of models) {
    try {
      return await tryGeminiModel({
        apiKey: options.apiKey,
        modelName,
        data: options.data,
        mimeType: options.mimeType,
        sleep: options.sleep,
      });
    } catch (err) {
      if (isNotFoundModelError(err) || isQuotaOrRateLimitError(err)) {
        if (isQuotaOrRateLimitError(err)) {
          lastQuotaErr = err;
          lastRetryAfter = parseRetryDelaySeconds(err) ?? lastRetryAfter;
        }
        continue;
      }
      throw err;
    }
  }

  if (lastQuotaErr) {
    throw new TimetableAiError({
      code: "quota_exceeded",
      message: "Gemini quota exceeded",
      status: 429,
      retryAfterSeconds: lastRetryAfter,
      hint:
        lastRetryAfter != null
          ? `Gemini free tier exhausted — retried. Try again in ${lastRetryAfter}s, or add timetable manually`
          : "Gemini free tier exhausted — retried. Try again later, or add timetable manually",
    });
  }

  throw new TimetableAiError({
    code: "provider_error",
    message: "All Gemini models failed to parse the timetable",
  });
}

export async function parseWithGroqVision(options: {
  apiKey: string;
  data: string;
  mimeType: string;
  fetchFn?: typeof fetch;
}): Promise<ParseTimetableResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const dataUrl = `data:${options.mimeType};base64,${options.data}`;

  const res = await fetchFn(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: TIMETABLE_PARSE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: TIMETABLE_PARSE_USER },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    const retryAfter = parseRetryDelaySeconds(detail) ?? undefined;
    if (res.status === 429) {
      throw new TimetableAiError({
        code: "quota_exceeded",
        message: "Groq rate limit exceeded",
        status: 429,
        retryAfterSeconds: retryAfter,
        hint: "Groq backup rate-limited. Try again shortly, or add timetable manually",
      });
    }
    throw new TimetableAiError({
      code: "provider_error",
      message: `Groq vision failed (${res.status})`,
      status: res.status,
    });
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  return parseJsonFromModelText(text);
}

/**
 * Parse a timetable photo via Gemini (retry + model fallback), then Groq vision.
 */
export async function parseTimetableImage(options: {
  apiKey: string;
  imageBase64: string;
  mimeType?: string;
  /** Override; defaults to env GROQ_API_KEY */
  groqApiKey?: string | null;
  deps?: ParseTimetableDeps;
}): Promise<ParseTimetableSuccess> {
  const { data, mimeType } = normalizeImageInput(
    options.imageBase64,
    options.mimeType,
  );
  const sleep = options.deps?.sleep ?? defaultSleep;
  const fetchFn = options.deps?.fetchFn ?? fetch;

  try {
    const result = await parseWithGemini({
      apiKey: options.apiKey,
      data,
      mimeType,
      sleep,
    });
    return { ...result, provider: "gemini" };
  } catch (geminiErr) {
    if (!isQuotaOrRateLimitError(geminiErr)) {
      if (geminiErr instanceof TimetableAiError) throw geminiErr;
      const message =
        geminiErr instanceof Error
          ? sanitizeProviderMessage(geminiErr.message)
          : "Failed to parse timetable";
      throw new TimetableAiError({
        code: "provider_error",
        message,
        status: getHttpStatus(geminiErr),
      });
    }

    const groqKey =
      options.groqApiKey === undefined
        ? getGroqApiKey()
        : options.groqApiKey?.trim() || null;

    const retryAfter =
      geminiErr instanceof TimetableAiError
        ? geminiErr.retryAfterSeconds
        : parseRetryDelaySeconds(geminiErr);

    if (!groqKey) {
      throw new TimetableAiError({
        code: "quota_exceeded",
        message: "Gemini quota exceeded",
        status: 429,
        retryAfterSeconds: retryAfter,
        hint:
          retryAfter != null
            ? `Gemini free tier exhausted — retried. Try again in ${retryAfter}s, or add timetable manually`
            : "Gemini free tier exhausted — retried. Try again later, or add timetable manually",
      });
    }

    try {
      const result = await parseWithGroqVision({
        apiKey: groqKey,
        data,
        mimeType,
        fetchFn,
      });
      return { ...result, provider: "groq" };
    } catch (groqErr) {
      const groqRetry =
        groqErr instanceof TimetableAiError
          ? groqErr.retryAfterSeconds
          : parseRetryDelaySeconds(groqErr);

      throw new TimetableAiError({
        code: "quota_exceeded",
        message: "Gemini quota exceeded",
        status: 429,
        retryAfterSeconds: groqRetry ?? retryAfter,
        hint:
          "Gemini free tier exhausted — retried; used Groq fallback. Try again later, or add timetable manually",
      });
    }
  }
}

/** Strip noisy Google RPC detail dumps from user-facing messages. */
export function sanitizeProviderMessage(message: string): string {
  // Drop long JSON/array dumps; keep first line / short summary
  const withoutRpc = message
    .replace(/\[\s*\{[\s\S]*\}\s*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutRpc.length <= 240) return withoutRpc || "AI provider error";
  return `${withoutRpc.slice(0, 200)}…`;
}
