import { describe, expect, it } from "vitest";
import {
  buildGroupSlug,
  canDeleteGroupMessage,
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

describe("canDeleteGroupMessage", () => {
  it("allows authors to delete their own messages", () => {
    expect(
      canDeleteGroupMessage({
        authorId: "user_a",
        actorId: "user_a",
        actorRole: "member",
      }),
    ).toBe(true);
  });

  it("allows admins to delete any message", () => {
    expect(
      canDeleteGroupMessage({
        authorId: "user_a",
        actorId: "user_b",
        actorRole: "admin",
      }),
    ).toBe(true);
  });

  it("denies non-authors who are not admins", () => {
    expect(
      canDeleteGroupMessage({
        authorId: "user_a",
        actorId: "user_b",
        actorRole: "member",
      }),
    ).toBe(false);
  });

  it("denies non-members", () => {
    expect(
      canDeleteGroupMessage({
        authorId: "user_a",
        actorId: "user_b",
        actorRole: null,
      }),
    ).toBe(false);
  });
});
