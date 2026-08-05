import { describe, expect, it } from "vitest";
import {
  localBunkAdviceFromStats,
  looksLikeBunkOrStandingQuestion,
} from "@/lib/ai/local-coach-fallback";

describe("local-coach-fallback", () => {
  it("detects bunk / standing questions", () => {
    expect(looksLikeBunkOrStandingQuestion("What can I bunk?")).toBe(true);
    expect(looksLikeBunkOrStandingQuestion("How am I doing?")).toBe(true);
    expect(looksLikeBunkOrStandingQuestion("Add subject")).toBe(false);
  });

  it("formats bunk lines from coach stats", () => {
    const text = localBunkAdviceFromStats({
      empty: false,
      subjects: [
        {
          shortCode: "CS402",
          percentage: 88,
          risk: "Safe",
          canBunk: 3,
          recover: 0,
        },
        {
          shortCode: "OS",
          percentage: 62,
          risk: "Critical",
          canBunk: 0,
          recover: 4,
        },
      ],
    });
    expect(text).toMatch(/CS402: can bunk 3/);
    expect(text).toMatch(/Protect:.*OS/);
    expect(text).toMatch(/rate-limited|busy/i);
  });

  it("returns empty-state hint when no marks", () => {
    const text = localBunkAdviceFromStats({ empty: true, subjects: [] });
    expect(text).toMatch(/No attendance marks/i);
  });
});
