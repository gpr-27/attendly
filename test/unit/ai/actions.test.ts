import { describe, expect, it } from "vitest";
import {
  describeAttendlyAction,
  extractActionsFromCoachReply,
  isDestructiveAction,
  parseAgentActionsPayload,
  attendlyActionSchema,
} from "@/lib/ai/actions";
import { detectFlowIntent, beginFlow, advanceFlow, isChatOnlyMessage, isMutativeAgentRequest, looksLikeChatAside } from "@/lib/ai/agent-flows";

describe("attendlyActionSchema", () => {
  it("accepts addSubject / deleteSubject / moveSession", () => {
    expect(
      attendlyActionSchema.safeParse({
        type: "addSubject",
        name: "Mathematics",
        shortCode: "Maths",
      }).success,
    ).toBe(true);

    expect(
      attendlyActionSchema.safeParse({
        type: "deleteSubject",
        shortCode: "OS",
      }).success,
    ).toBe(true);

    expect(
      attendlyActionSchema.safeParse({
        type: "moveSession",
        sessionId: "abc",
        newDate: "2026-08-08",
        startTime: "14:00",
        endTime: "15:00",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown action types", () => {
    expect(
      attendlyActionSchema.safeParse({ type: "hackThePlanet" }).success,
    ).toBe(false);
  });
});

describe("parseAgentActionsPayload", () => {
  it("parses mocked model JSON into actions", () => {
    const raw = `{
      "message": "I'll add Maths for you.",
      "actions": [
        { "type": "addSubject", "name": "Mathematics", "shortCode": "Maths" }
      ],
      "chips": ["Done"]
    }`;
    const parsed = parseAgentActionsPayload(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.actions).toHaveLength(1);
    expect(parsed!.actions[0]!.type).toBe("addSubject");
    expect(isDestructiveAction(parsed!.actions[0]!)).toBe(false);
  });

  it("extracts actions from fenced coach reply", () => {
    const reply = `Adding OS delete.\n\`\`\`json
{"message":"Confirm delete OS","actions":[{"type":"deleteSubject","shortCode":"OS"}]}
\`\`\``;
    const payload = extractActionsFromCoachReply(reply);
    expect(payload.actions[0]?.type).toBe("deleteSubject");
    expect(isDestructiveAction(payload.actions[0]!)).toBe(true);
    expect(describeAttendlyAction(payload.actions[0]!)).toMatch(/Delete OS/i);
  });
});

describe("agent flows", () => {
  it("walks add-subject through name → code → color → confirm", () => {
    const intent = detectFlowIntent("add a new subject");
    expect(intent?.id).toBe("addSubject");
    const start = beginFlow(intent!);
    expect(start.message).toMatch(/subject name/i);

    const named = advanceFlow(start.next, "Discrete Maths");
    expect(named.message).toMatch(/Short code/i);
    expect(named.chips?.[0]).toBeTruthy();

    const coded = advanceFlow(named.next, named.chips![0]!);
    expect(coded.message).toMatch(/Color/i);

    const colored = advanceFlow(coded.next, "Skip");
    expect(colored.chips).toContain("Confirm");

    const done = advanceFlow(colored.next, "Confirm");
    expect(done.actions?.[0]?.type).toBe("addSubject");
    if (done.actions?.[0]?.type === "addSubject") {
      expect(done.actions[0].name).toBe("Discrete Maths");
    }
  });

  it("detects delete subject intent with confirm chips", () => {
    const intent = detectFlowIntent("delete subject OS");
    expect(intent?.draft.shortCode?.toLowerCase()).toBe("os");
    const start = beginFlow(intent!);
    expect(start.needsConfirm).toBe(true);
    expect(start.chips).toContain("Confirm delete");
  });

  it("keeps casual / capability messages in chat (no walkthrough)", () => {
    for (const msg of ["hi", "ok", "thanks", "what can u do", "What can you do?", "how am I doing?"]) {
      expect(isChatOnlyMessage(msg)).toBe(true);
      expect(detectFlowIntent(msg)).toBeNull();
      expect(isMutativeAgentRequest(msg)).toBe(false);
    }
  });

  it("does not start holiday flow from bare mention", () => {
    expect(detectFlowIntent("is tomorrow a holiday?")).toBeNull();
    expect(detectFlowIntent("set holiday tomorrow")?.id).toBe("setHoliday");
  });

  it("treats mid-guide questions as chat asides", () => {
    expect(looksLikeChatAside("how am I doing?")).toBe(true);
    expect(looksLikeChatAside("what can I bunk")).toBe(true);
    expect(looksLikeChatAside("Discrete Maths")).toBe(false);
    expect(looksLikeChatAside("Confirm")).toBe(false);
  });

  it("routes clear mutative asks to agent", () => {
    expect(isMutativeAgentRequest("add subject DSA")).toBe(true);
    expect(isMutativeAgentRequest("mark me present")).toBe(true);
    expect(isMutativeAgentRequest("Add subject")).toBe(true);
  });
});
