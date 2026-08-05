import { describe, expect, it } from "vitest";
import {
  buildGroupSlug,
  escapeIlikePattern,
  normalizeSearchQuery,
  slugifyGroupName,
  validateGroupName,
  validateMessageBody,
} from "@/lib/groups/validation";

describe("validateGroupName", () => {
  it("rejects empty names", () => {
    expect(validateGroupName(" ").ok).toBe(false);
  });

  it("accepts valid names", () => {
    expect(validateGroupName("CSE Section B").ok).toBe(true);
  });
});

describe("validateMessageBody", () => {
  it("rejects whitespace-only", () => {
    expect(validateMessageBody("   ").ok).toBe(false);
  });

  it("accepts non-empty messages", () => {
    expect(validateMessageBody("Hello class").ok).toBe(true);
  });
});

describe("slugifyGroupName", () => {
  it("produces lowercase hyphenated slugs", () => {
    expect(slugifyGroupName("CSE 2027 — Section B")).toBe("cse-2027-section-b");
  });
});

describe("buildGroupSlug", () => {
  it("appends unique suffix", () => {
    expect(buildGroupSlug("My Group", "abc12345")).toMatch(/^my-group-abc12345$/);
  });
});

describe("escapeIlikePattern", () => {
  it("escapes wildcards", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
  });
});

describe("normalizeSearchQuery", () => {
  it("trims and caps length", () => {
    expect(normalizeSearchQuery("  os lab  ")).toBe("os lab");
  });
});
