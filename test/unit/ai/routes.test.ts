import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AI Route Handlers — no real Groq/Gemini calls.
 * Keys missing → 503 + setupHint; mocked provider → validated shape.
 */

const getGroqApiKey = vi.fn();
const runCoach = vi.fn();
const getGeminiApiKey = vi.fn();
const parseTimetableImage = vi.fn();

vi.mock("@/lib/ai/groq-coach", () => ({
  getGroqApiKey: (...args: unknown[]) => getGroqApiKey(...args),
  runCoach: (...args: unknown[]) => runCoach(...args),
  CoachAiError: class CoachAiError extends Error {
    code: string;
    status: number;
    constructor(
      message: string,
      options: { code: string; status: number },
    ) {
      super(message);
      this.name = "CoachAiError";
      this.code = options.code;
      this.status = options.status;
    }
  },
  COACH_RATE_LIMIT_MESSAGE:
    "Coach is temporarily rate-limited (tried the faster backup model too). Try again in a few minutes — bunk math and guided chips still work offline.",
}));

vi.mock("@/lib/ai/gemini-timetable", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/gemini-timetable")>();
  return {
    ...actual,
    getGeminiApiKey: (...args: unknown[]) => getGeminiApiKey(...args),
    parseTimetableImage: (...args: unknown[]) => parseTimetableImage(...args),
  };
});

describe("POST /api/ai/coach", () => {
  beforeEach(() => {
    getGroqApiKey.mockReset();
    runCoach.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns clear setup hint when GROQ_API_KEY is missing", async () => {
    getGroqApiKey.mockReturnValue(null);
    const { POST } = await import("@/app/api/ai/coach/route");
    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: { overallPct: 80 },
          message: "Can I bunk tomorrow?",
        }),
      }),
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      error: string;
      code?: string;
      setupHint?: string;
    };
    expect(body.error).toMatch(/GROQ_API_KEY/i);
    expect(body.code).toBe("missing_key");
    expect(body.setupHint).toMatch(/Bunk math/i);
  });

  it("returns validated reply when provider is mocked", async () => {
    getGroqApiKey.mockReturnValue("test-key-not-real");
    runCoach.mockResolvedValue({
      reply: "Based on your stats, protect the lowest subject first.",
      mode: "chat",
    });

    const { POST } = await import("@/app/api/ai/coach/route");
    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: { overallPct: 78, subjects: [] },
          message: "Any tips?",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(typeof body.reply).toBe("string");
    expect(body.reply.length).toBeGreaterThan(0);
  });
});

describe("POST /api/ai/parse-timetable", () => {
  beforeEach(() => {
    getGeminiApiKey.mockReset();
    getGroqApiKey.mockReset();
    parseTimetableImage.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns setup hint when both AI keys are missing", async () => {
    getGeminiApiKey.mockReturnValue(null);
    getGroqApiKey.mockReturnValue(null);

    const { POST } = await import("@/app/api/ai/parse-timetable/route");
    const res = await POST(
      new Request("http://localhost/api/ai/parse-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: "aaaa",
          mimeType: "image/png",
        }),
      }),
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      error: string;
      code?: string;
      setupHint?: string;
    };
    expect(body.code).toBe("missing_key");
    expect(body.setupHint).toMatch(/Bunk math/i);
    expect(parseTimetableImage).not.toHaveBeenCalled();
  });
});
