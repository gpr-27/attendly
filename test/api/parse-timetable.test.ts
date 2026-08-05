import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getGeminiApiKey = vi.fn();
const parseTimetableImage = vi.fn();
const parseWithGroqVision = vi.fn();
const getGroqApiKey = vi.fn();

vi.mock("@/lib/ai/gemini-timetable", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/gemini-timetable")>();
  return {
    ...actual,
    getGeminiApiKey: (...args: unknown[]) => getGeminiApiKey(...args),
    parseTimetableImage: (...args: unknown[]) => parseTimetableImage(...args),
    parseWithGroqVision: (...args: unknown[]) => parseWithGroqVision(...args),
  };
});

vi.mock("@/lib/ai/groq-coach", () => ({
  getGroqApiKey: (...args: unknown[]) => getGroqApiKey(...args),
}));

describe("POST /api/ai/parse-timetable", () => {
  beforeEach(() => {
    getGeminiApiKey.mockReset();
    parseTimetableImage.mockReset();
    parseWithGroqVision.mockReset();
    getGroqApiKey.mockReset();
    getGroqApiKey.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 + setupHint when both AI keys are missing", async () => {
    getGeminiApiKey.mockReturnValue(null);
    getGroqApiKey.mockReturnValue(null);
    const { POST } = await import("@/app/api/ai/parse-timetable/route");

    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "QUJD" }),
      }),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("missing_key");
    expect(body.setupHint).toMatch(/Bunk math/i);
    expect(parseTimetableImage).not.toHaveBeenCalled();
  });

  it("returns 400 when image is missing", async () => {
    getGeminiApiKey.mockReturnValue("test-key-not-real");
    const { POST } = await import("@/app/api/ai/parse-timetable/route");

    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
    expect(parseTimetableImage).not.toHaveBeenCalled();
  });

  it("returns mocked parse result without calling a real provider", async () => {
    getGeminiApiKey.mockReturnValue("test-key-not-real");
    parseTimetableImage.mockResolvedValue({
      subjects: [{ name: "Algorithms", shortCode: "ALG" }],
      slots: [
        {
          subjectShortCode: "ALG",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
        },
      ],
      provider: "gemini",
    });

    const { POST } = await import("@/app/api/ai/parse-timetable/route");
    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "QUJD", mimeType: "image/png" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subjects[0].shortCode).toBe("ALG");
    expect(parseTimetableImage).toHaveBeenCalledOnce();
    expect(parseTimetableImage.mock.calls[0]![0].apiKey).toBe(
      "test-key-not-real",
    );
  });

  it("uses Groq vision alone when Gemini key missing but Groq present", async () => {
    getGeminiApiKey.mockReturnValue(null);
    getGroqApiKey.mockReturnValue("groq-test-key");
    parseWithGroqVision.mockResolvedValue({
      subjects: [{ name: "DBMS", shortCode: "DB" }],
      slots: [
        {
          subjectShortCode: "DB",
          dayOfWeek: 2,
          start: "10:00",
          end: "11:00",
          location: "Lab 1",
        },
      ],
    });

    const { POST } = await import("@/app/api/ai/parse-timetable/route");
    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "QUJD" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("groq");
    expect(body.subjects[0].shortCode).toBe("DB");
    expect(parseTimetableImage).not.toHaveBeenCalled();
    expect(parseWithGroqVision).toHaveBeenCalledOnce();
  });

  it("returns structured quota_exceeded without raw RPC dumps", async () => {
    getGeminiApiKey.mockReturnValue("test-key-not-real");
    const { TimetableAiError } = await import("@/lib/ai/gemini-timetable");
    parseTimetableImage.mockRejectedValue(
      new TimetableAiError({
        code: "quota_exceeded",
        message: "Gemini quota exceeded",
        status: 429,
        retryAfterSeconds: 44,
        hint: "Gemini free tier exhausted — retried. Try again in 44s, or add timetable manually",
      }),
    );

    const { POST } = await import("@/app/api/ai/parse-timetable/route");
    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "QUJD" }),
      }),
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("quota_exceeded");
    expect(body.retryAfterSeconds).toBe(44);
    expect(body.hint).toMatch(/add timetable manually/i);
    expect(JSON.stringify(body)).not.toMatch(/errorDetails|@type|RPC/i);
  });
});
