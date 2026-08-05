import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";

/**
 * Gemini timetable parse — retries, model fallback, Groq vision.
 * No real network.
 */

const sampleResult = {
  subjects: [{ name: "Algorithms", shortCode: "ALG" }],
  slots: [
    {
      subjectShortCode: "ALG",
      dayOfWeek: 1,
      start: "09:00",
      end: "10:00",
    },
  ],
};

describe("gemini-timetable helpers", () => {
  it("parseRetryDelaySeconds reads Please retry in ~Ns", async () => {
    const { parseRetryDelaySeconds } = await import(
      "@/lib/ai/gemini-timetable"
    );
    expect(
      parseRetryDelaySeconds(
        new Error(
          "[GoogleGenerativeAI Error]: Quota exceeded … Please retry in ~44s",
        ),
      ),
    ).toBe(44);
  });

  it("parseRetryDelaySeconds reads retryDelay field", async () => {
    const { parseRetryDelaySeconds } = await import(
      "@/lib/ai/gemini-timetable"
    );
    const err = new GoogleGenerativeAIFetchError(
      "429 Too Many Requests",
      429,
      "Too Many Requests",
      [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "12s" }],
    );
    expect(parseRetryDelaySeconds(err)).toBe(12);
  });

  it("getGeminiModelChain prefers GEMINI_MODEL", async () => {
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    vi.resetModules();
    const { getGeminiModelChain } = await import("@/lib/ai/gemini-timetable");
    const chain = getGeminiModelChain();
    expect(chain[0]).toBe("gemini-2.5-flash");
    expect(chain).toContain("gemini-2.0-flash");
    process.env.GEMINI_MODEL = original;
    vi.resetModules();
  });
});

describe("parseTimetableImage fallback", () => {
  const originalGeminiModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    process.env.GEMINI_MODEL = originalGeminiModel;
    vi.doUnmock("@google/generative-ai");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("falls back to Groq after Gemini 429 (mocked, no network)", async () => {
    const generateContent = vi.fn().mockRejectedValue(
      new GoogleGenerativeAIFetchError(
        "Quota exceeded for free_tier … Please retry in ~44s",
        429,
        "Too Many Requests",
        [{ retryDelay: "44s" }],
      ),
    );

    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return { generateContent };
        }
      },
      GoogleGenerativeAIFetchError,
      GoogleGenerativeAIError: class extends Error {},
    }));

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleResult),
            },
          },
        ],
      }),
    });

    const sleep = vi.fn().mockResolvedValue(undefined);

    const { parseTimetableImage } = await import("@/lib/ai/gemini-timetable");

    const result = await parseTimetableImage({
      apiKey: "fake-gemini",
      imageBase64: "QUJD",
      mimeType: "image/png",
      groqApiKey: "fake-groq",
      deps: { sleep, fetchFn: fetchFn as unknown as typeof fetch },
    });

    expect(result.provider).toBe("groq");
    expect(result.subjects[0]?.shortCode).toBe("ALG");
    expect(generateContent).toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(String(fetchFn.mock.calls[0]![0])).toContain(
      "api.groq.com/openai/v1/chat/completions",
    );
    // Should have attempted a wait on 429 before giving up Gemini chain
    expect(sleep).toHaveBeenCalled();
  });

  it("returns quota_exceeded when Gemini 429 and no Groq key", async () => {
    const generateContent = vi.fn().mockRejectedValue(
      new GoogleGenerativeAIFetchError(
        "Quota exceeded … Please retry in ~20s",
        429,
        "Too Many Requests",
      ),
    );

    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return { generateContent };
        }
      },
      GoogleGenerativeAIFetchError,
      GoogleGenerativeAIError: class extends Error {},
    }));

    const sleep = vi.fn().mockResolvedValue(undefined);
    const { parseTimetableImage, TimetableAiError } = await import(
      "@/lib/ai/gemini-timetable"
    );

    await expect(
      parseTimetableImage({
        apiKey: "fake-gemini",
        imageBase64: "QUJD",
        mimeType: "image/png",
        groqApiKey: null,
        deps: { sleep },
      }),
    ).rejects.toMatchObject({
      code: "quota_exceeded",
      name: "TimetableAiError",
    });

    try {
      await parseTimetableImage({
        apiKey: "fake-gemini",
        imageBase64: "QUJD",
        mimeType: "image/png",
        groqApiKey: null,
        deps: { sleep },
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TimetableAiError);
      expect((e as InstanceType<typeof TimetableAiError>).hint).toMatch(
        /add timetable manually/i,
      );
    }
  });

  it("succeeds on Gemini after one 429 then success", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        new GoogleGenerativeAIFetchError(
          "Please retry in ~2s",
          429,
          "Too Many Requests",
        ),
      )
      .mockResolvedValue({
        response: {
          text: () => JSON.stringify(sampleResult),
        },
      });

    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return { generateContent };
        }
      },
      GoogleGenerativeAIFetchError,
      GoogleGenerativeAIError: class extends Error {},
    }));

    const sleep = vi.fn().mockResolvedValue(undefined);
    const { parseTimetableImage } = await import("@/lib/ai/gemini-timetable");

    const result = await parseTimetableImage({
      apiKey: "fake-gemini",
      imageBase64: "QUJD",
      mimeType: "image/png",
      groqApiKey: null,
      deps: { sleep },
    });

    expect(result.provider).toBe("gemini");
    expect(result.subjects[0]?.shortCode).toBe("ALG");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });
});
