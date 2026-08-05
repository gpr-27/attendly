import { describe, expect, it } from "vitest";
import {
  buildAutoInsightPrompt,
  buildFocusPageContext,
  buildInsightCards,
  buildInsightTip,
  focusKey,
} from "@/lib/ai/ai-focus";

describe("ai-focus helpers", () => {
  const subject = {
    kind: "subject" as const,
    subjectId: "sub-1",
    shortCode: "DSA",
    name: "Data Structures",
    percentage: 72.5,
    risk: "Warning" as const,
    canBunk: 0,
    recover: 2,
    attended: 29,
    total: 40,
  };

  it("builds four subject insight cards", () => {
    const cards = buildInsightCards(subject);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.id)).toEqual([
      "bunks",
      "risk",
      "skip",
      "pattern",
    ]);
    expect(cards.find((c) => c.id === "skip")?.value).toContain("recover");
  });

  it("builds session attend prompt and context", () => {
    const session = {
      kind: "session" as const,
      sessionId: "sess-1",
      shortCode: "DSA",
      name: "Data Structures",
      percentage: 72.5,
      risk: "watch" as const,
      startLabel: "10:00",
      endLabel: "11:00",
      ymd: "2026-08-05",
      impactLine: "Skip DSA → 70% · Attend → 74%",
    };
    expect(buildAutoInsightPrompt(session)).toMatch(/Should I attend DSA/);
    expect(buildFocusPageContext(session)).toContain("sessionId=sess-1");
    expect(focusKey(session)).toBe("session:sess-1");
  });

  it("subject digest prompt cites shortCode", () => {
    expect(buildAutoInsightPrompt(subject)).toContain("DSA");
    expect(buildFocusPageContext(subject)).toContain("subjectId=sub-1");
  });

  it("builds a short local tip for subject focus", () => {
    expect(buildInsightTip(subject)).toMatch(/recover/i);
  });
});
