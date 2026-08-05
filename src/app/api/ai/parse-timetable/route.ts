import { NextResponse } from "next/server";

import { AI_SETUP_HINT, missingKeyPayload } from "@/lib/ai/ai-status";
import {
  getGeminiApiKey,
  parseTimetableImage,
  parseWithGroqVision,
  TimetableAiError,
  sanitizeProviderMessage,
  normalizeImageInput,
} from "@/lib/ai/gemini-timetable";
import { getGroqApiKey } from "@/lib/ai/groq-coach";

export const runtime = "nodejs";

type JsonBody = {
  imageBase64?: string;
  image?: string;
  mimeType?: string;
};

async function readImageFromRequest(
  request: Request,
): Promise<{ imageBase64: string; mimeType?: string } | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const fileEntry = form.get("image") ?? form.get("file");
    const mimeFromForm = form.get("mimeType");

    if (fileEntry instanceof File) {
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      if (buffer.length === 0) {
        return NextResponse.json(
          { error: "Uploaded image is empty" },
          { status: 400 },
        );
      }
      return {
        imageBase64: buffer.toString("base64"),
        mimeType:
          fileEntry.type ||
          (typeof mimeFromForm === "string" ? mimeFromForm : undefined),
      };
    }

    const base64Field = form.get("imageBase64") ?? form.get("image");
    if (typeof base64Field === "string" && base64Field.trim()) {
      return {
        imageBase64: base64Field,
        mimeType:
          typeof mimeFromForm === "string" ? mimeFromForm : undefined,
      };
    }

    return NextResponse.json(
      {
        error:
          'Expected form field "image" (file) or "imageBase64" (string)',
      },
      { status: 400 },
    );
  }

  let body: JsonBody;
  try {
    body = (await request.json()) as JsonBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const imageBase64 = body.imageBase64 ?? body.image;
  if (!imageBase64?.trim()) {
    return NextResponse.json(
      {
        error:
          'Provide imageBase64 (or image) in JSON, or multipart file field "image"',
      },
      { status: 400 },
    );
  }

  return { imageBase64, mimeType: body.mimeType };
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof TimetableAiError) {
    const status =
      err.code === "quota_exceeded"
        ? 429
        : err.code === "validation_error"
          ? 502
          : 502;

    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.retryAfterSeconds != null
          ? { retryAfterSeconds: err.retryAfterSeconds }
          : {}),
        ...(err.hint ? { hint: err.hint } : {}),
      },
      { status },
    );
  }

  const message =
    err instanceof Error
      ? sanitizeProviderMessage(err.message)
      : "Failed to parse timetable";

  return NextResponse.json({ error: message }, { status: 502 });
}

export async function POST(request: Request) {
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();

  if (!geminiKey && !groqKey) {
    return NextResponse.json(
      {
        ...missingKeyPayload("GEMINI_API_KEY"),
        error:
          "GEMINI_API_KEY (and GROQ_API_KEY backup) not set. Add keys to .env.local or Vercel env.",
        setupHint: AI_SETUP_HINT,
      },
      { status: 503 },
    );
  }

  const image = await readImageFromRequest(request);
  if (image instanceof NextResponse) return image;

  try {
    // Local-first: Groq vision alone when Gemini key missing.
    if (!geminiKey && groqKey) {
      const { data, mimeType } = normalizeImageInput(
        image.imageBase64,
        image.mimeType,
      );
      const result = await parseWithGroqVision({
        apiKey: groqKey,
        data,
        mimeType,
      });
      return NextResponse.json({ ...result, provider: "groq" });
    }

    // Primary path: Gemini retry/model chain + Groq vision fallback (unchanged).
    const result = await parseTimetableImage({
      apiKey: geminiKey!,
      imageBase64: image.imageBase64,
      mimeType: image.mimeType,
      groqApiKey: groqKey,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
