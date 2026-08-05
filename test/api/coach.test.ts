import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getGroqApiKey = vi.fn();
const runCoach = vi.fn();

const RATE_LIMIT_MSG =
  "Coach is temporarily rate-limited (tried the faster backup model too). Try again in a few minutes — bunk math and guided chips still work offline.";

class MockCoachAiError extends Error {
  code: "rate_limited" | "provider_error";
  status: number;
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

vi.mock("@/lib/ai/groq-coach", () => ({
  getGroqApiKey: (...args: unknown[]) => getGroqApiKey(...args),
  runCoach: (...args: unknown[]) => runCoach(...args),
  CoachAiError: MockCoachAiError,
  COACH_RATE_LIMIT_MESSAGE: RATE_LIMIT_MSG,
}));

describe("POST /api/ai/coach", () => {
  beforeEach(() => {
    getGroqApiKey.mockReset();
    runCoach.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 + setupHint when GROQ_API_KEY is missing", async () => {
    getGroqApiKey.mockReturnValue(null);
    const { POST } = await import("@/app/api/ai/coach/route");

    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stats: { overallPct: 80 },
          message: "Can I bunk?",
        }),
      }),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/GROQ_API_KEY/);
    expect(body.code).toBe("missing_key");
    expect(body.setupHint).toMatch(/Bunk math/i);
    expect(runCoach).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    getGroqApiKey.mockReturnValue("test-key-not-real");
    const { POST } = await import("@/app/api/ai/coach/route");

    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stats: {}, message: "" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(runCoach).not.toHaveBeenCalled();
  });

  it("returns mocked coach reply without calling a real provider", async () => {
    getGroqApiKey.mockReturnValue("test-key-not-real");
    runCoach.mockResolvedValue({
      reply: "You are at 80%. One skip keeps you above 75%.",
      mode: "chat",
    });

    const { POST } = await import("@/app/api/ai/coach/route");
    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stats: { overallPct: 80, canSkip: 1 },
          message: "Can I bunk Algorithms tomorrow?",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toMatch(/80%/);
    expect(runCoach).toHaveBeenCalledOnce();
    expect(runCoach.mock.calls[0]![0].apiKey).toBe("test-key-not-real");
  });

  it("forwards digest mode and policyResearch flag", async () => {
    getGroqApiKey.mockReturnValue("test-key-not-real");
    runCoach.mockResolvedValue({
      reply: "Protect OS Lab this week.",
      mode: "digest",
    });

    const { POST } = await import("@/app/api/ai/coach/route");
    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stats: { protectThisWeek: [{ shortCode: "OS Lab", risk: "Critical" }] },
          message: "Weekly digest",
          mode: "digest",
          voiceStyle: true,
          policyResearch: false,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(runCoach.mock.calls[0]![0].mode).toBe("digest");
    expect(runCoach.mock.calls[0]![0].policyResearch).toBe(false);
  });

  it("returns friendly 429 when CoachAiError is rate_limited", async () => {
    getGroqApiKey.mockReturnValue("test-key-not-real");
    runCoach.mockRejectedValue(
      new MockCoachAiError(RATE_LIMIT_MSG, {
        code: "rate_limited",
        status: 429,
      }),
    );

    const { POST } = await import("@/app/api/ai/coach/route");
    const res = await POST(
      new Request("http://localhost/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stats: {},
          message: "What can I bunk?",
        }),
      }),
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("rate_limited");
    expect(body.error).toBe(RATE_LIMIT_MSG);
    expect(body.error).not.toMatch(/org_|tokens per day|\{/);
  });
});
