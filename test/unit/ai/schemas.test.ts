import { describe, expect, it } from "vitest";
import {
  coachRequestSchema,
  coachResponseSchema,
  parseTimetableResultSchema,
} from "@/lib/ai/schemas";
import { normalizeImageInput } from "@/lib/ai/gemini-timetable";

describe("parseTimetableResultSchema", () => {
  it("accepts a minimal valid parse result", () => {
    const result = parseTimetableResultSchema.safeParse({
      subjects: [{ name: "Data Structures", shortCode: "DSA" }],
      slots: [
        {
          subjectShortCode: "DSA",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty subjects", () => {
    const result = parseTimetableResultSchema.safeParse({
      subjects: [],
      slots: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects bad time format", () => {
    const result = parseTimetableResultSchema.safeParse({
      subjects: [{ name: "OS", shortCode: "OS" }],
      slots: [
        {
          subjectShortCode: "OS",
          dayOfWeek: 2,
          start: "9:00",
          end: "10:00",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("coachRequestSchema", () => {
  it("requires a non-empty message and stats object", () => {
    expect(
      coachRequestSchema.safeParse({
        stats: { overallPct: 80 },
        message: "Can I bunk tomorrow?",
      }).success,
    ).toBe(true);

    expect(
      coachRequestSchema.safeParse({ stats: {}, message: "" }).success,
    ).toBe(false);
  });

  it("defaults mode chat, voiceStyle true, policyResearch false", () => {
    const parsed = coachRequestSchema.safeParse({
      stats: {},
      message: "Digest?",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mode).toBe("chat");
      expect(parsed.data.voiceStyle).toBe(true);
      expect(parsed.data.policyResearch).toBe(false);
    }
  });

  it("accepts optional pageContext", () => {
    const parsed = coachRequestSchema.safeParse({
      stats: {},
      message: "Help with this day",
      pageContext: "User is on Calendar. Selected day: 2026-08-05.",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pageContext).toContain("Calendar");
    }
  });
});

describe("coachResponseSchema", () => {
  it("requires a reply string", () => {
    expect(coachResponseSchema.safeParse({ reply: "Stay above 75%." }).success).toBe(
      true,
    );
    expect(coachResponseSchema.safeParse({ reply: "" }).success).toBe(false);
  });

  it("accepts optional structured plan", () => {
    expect(
      coachResponseSchema.safeParse({
        reply: "Protect OS.",
        mode: "plan",
        plan: {
          weekFocus: "OS",
          protect: [{ shortCode: "OS", reason: "Critical in stats" }],
        },
      }).success,
    ).toBe(true);
  });
});

describe("parseTimetableResultSchema faculty/room", () => {
  it("accepts portal room and faculty fields", () => {
    const result = parseTimetableResultSchema.safeParse({
      subjects: [
        { name: "Operating Systems", shortCode: "OS", faculty: "Dr. Rao" },
      ],
      slots: [
        {
          subjectShortCode: "OS",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
          location: "Lab 3",
          faculty: "Dr. Rao",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("normalizeImageInput", () => {
  it("strips a data-URL prefix", () => {
    const out = normalizeImageInput(
      "data:image/png;base64,QUJD",
      "image/jpeg",
    );
    expect(out.mimeType).toBe("image/png");
    expect(out.data).toBe("QUJD");
  });

  it("defaults mime when raw base64 is passed", () => {
    const out = normalizeImageInput("QUJD");
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.data).toBe("QUJD");
  });
});
