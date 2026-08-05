import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("groq-sdk", () => ({
  default: class {
    chat = {
      completions: {
        create: (...args: unknown[]) => create(...args),
      },
    };
  },
}));

function rateLimitError(status = 429) {
  const err = new Error(
    `${status} Rate limit reached for model \`llama-3.3-70b-versatile\` in organization org_test on tokens per day (TPD)`,
  ) as Error & { status: number; error: { code: string } };
  err.status = status;
  err.error = { code: "rate_limit_exceeded" };
  return err;
}

describe("runCoach v2", () => {
  afterEach(() => {
    create.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns voice-style chat reply grounded on stats (mocked)", async () => {
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: "Protect OS Lab — stats show Critical at 62%. Skip nothing there.",
          },
        },
      ],
    });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    const result = await runCoach({
      apiKey: "test-key-not-real",
      stats: {
        subjects: [{ shortCode: "OS Lab", risk: "Critical", percentage: 62 }],
      },
      message: "What should I protect?",
      mode: "chat",
      voiceStyle: true,
    });

    expect(result.reply).toMatch(/62%/);
    expect(result.mode).toBe("chat");
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0].model).toBe("llama-3.3-70b-versatile");
  });

  it("parses structured plan JSON from plan mode", async () => {
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: `Protect OS this week.\n\`\`\`json
{"weekFocus":"Protect OS","protect":[{"shortCode":"OS","reason":"Critical at 70% in stats"}],"actions":["Attend every OS class"]}
\`\`\``,
          },
        },
      ],
    });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    const result = await runCoach({
      apiKey: "test-key-not-real",
      stats: { subjects: [{ shortCode: "OS", risk: "Critical", percentage: 70 }] },
      message: "Week plan",
      mode: "plan",
    });

    expect(result.plan?.protect[0]?.shortCode).toBe("OS");
    expect(result.reply).toMatch(/Protect OS/i);
  });

  it("calls groq/compound only when policyResearch is on", async () => {
    create
      .mockResolvedValueOnce({
        choices: [{ message: { content: "OD usually needs a form." } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "Based on your 80% stats, one bunk is fine. OD tip: file the form.",
            },
          },
        ],
      });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    const result = await runCoach({
      apiKey: "test-key-not-real",
      stats: { overall: { percentage: 80 } },
      message: "What is OD policy?",
      policyResearch: true,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0].model).toBe("groq/compound");
    expect(create.mock.calls[1]![0].model).toBe("llama-3.3-70b-versatile");
    expect(result.usedPolicyResearch).toBe(true);
  });

  it("does not call compound when policyResearch is off", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: "Stay above target using your stats." } }],
    });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    await runCoach({
      apiKey: "test-key-not-real",
      stats: {},
      message: "Tips?",
      policyResearch: false,
    });

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0].model).not.toBe("groq/compound");
  });

  it("retries once with 8B fallback on primary 429", async () => {
    create
      .mockRejectedValueOnce(rateLimitError(429))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "From your stats: OS can bunk 1 more this term.",
            },
          },
        ],
      });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    const result = await runCoach({
      apiKey: "test-key-not-real",
      stats: { subjects: [{ shortCode: "OS", canBunk: 1 }] },
      message: "What can I bunk?",
    });

    expect(result.reply).toMatch(/bunk 1/i);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0].model).toBe("llama-3.3-70b-versatile");
    expect(create.mock.calls[1]![0].model).toBe("llama-3.1-8b-instant");
  });

  it("retries on 503 then succeeds with fallback", async () => {
    create
      .mockRejectedValueOnce(rateLimitError(503))
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Backup model answer." } }],
      });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    const result = await runCoach({
      apiKey: "test-key-not-real",
      stats: {},
      message: "How am I doing?",
    });

    expect(result.reply).toBe("Backup model answer.");
    expect(create.mock.calls[1]![0].model).toBe("llama-3.1-8b-instant");
  });

  it("throws friendly CoachAiError when primary and fallback both rate-limit", async () => {
    create
      .mockRejectedValueOnce(rateLimitError(429))
      .mockRejectedValueOnce(rateLimitError(429));

    const { CoachAiError, COACH_RATE_LIMIT_MESSAGE, runCoach } =
      await import("@/lib/ai/groq-coach");

    await expect(
      runCoach({
        apiKey: "test-key-not-real",
        stats: {},
        message: "What can I bunk?",
      }),
    ).rejects.toMatchObject({
      name: "CoachAiError",
      code: "rate_limited",
      status: 429,
      message: COACH_RATE_LIMIT_MESSAGE,
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(CoachAiError).toBeDefined();
  });

  it("honors GROQ_MODEL and GROQ_FALLBACK_MODEL env overrides", async () => {
    vi.stubEnv("GROQ_MODEL", "custom-primary");
    vi.stubEnv("GROQ_FALLBACK_MODEL", "custom-fallback");

    create
      .mockRejectedValueOnce(rateLimitError(429))
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Custom fallback ok." } }],
      });

    const { runCoach } = await import("@/lib/ai/groq-coach");
    await runCoach({
      apiKey: "test-key-not-real",
      stats: {},
      message: "Hi",
    });

    expect(create.mock.calls[0]![0].model).toBe("custom-primary");
    expect(create.mock.calls[1]![0].model).toBe("custom-fallback");
  });
});
