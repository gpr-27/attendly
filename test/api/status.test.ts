import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAiStatus = vi.fn();

vi.mock("@/lib/ai/ai-status", () => ({
  getAiStatus: (...args: unknown[]) => getAiStatus(...args),
}));

describe("GET /api/ai/status", () => {
  beforeEach(() => {
    getAiStatus.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured flags without secrets", async () => {
    getAiStatus.mockReturnValue({
      groqConfigured: true,
      geminiConfigured: false,
      anyAiConfigured: true,
    });

    const { GET } = await import("@/app/api/ai/status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groqConfigured).toBe(true);
    expect(body.geminiConfigured).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/sk-|api[_-]?key/i);
  });
});
