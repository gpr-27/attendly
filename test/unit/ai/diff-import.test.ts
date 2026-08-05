import { describe, expect, it } from "vitest";
import {
  formatSlotLocation,
  planSlotDiff,
  slotKey,
} from "@/lib/ai/diff-import";

describe("formatSlotLocation", () => {
  it("joins room and faculty", () => {
    expect(
      formatSlotLocation({ location: "Lab 2", faculty: "Dr. Rao" }),
    ).toBe("Lab 2 · Dr. Rao");
  });

  it("returns whichever side is present", () => {
    expect(formatSlotLocation({ location: "A101" })).toBe("A101");
    expect(formatSlotLocation({ faculty: "Prof X" })).toBe("Prof X");
    expect(formatSlotLocation({})).toBeUndefined();
  });
});

describe("planSlotDiff", () => {
  const parsed = {
    subjects: [{ name: "OS", shortCode: "OS" }],
    slots: [
      {
        subjectShortCode: "OS",
        dayOfWeek: 1,
        start: "09:00",
        end: "10:00",
        location: "R1",
      },
      {
        subjectShortCode: "OS",
        dayOfWeek: 3,
        start: "11:00",
        end: "12:00",
        location: "R2",
        faculty: "Dr. A",
      },
    ],
  };

  it("diff mode adds new and updates changed location", () => {
    const plan = planSlotDiff({
      mode: "diff",
      parsed,
      existing: [
        {
          seriesId: "s1",
          subjectId: "sub1",
          shortCode: "OS",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
          location: "Old",
        },
      ],
    });

    expect(plan.summary.add).toBe(1);
    expect(plan.summary.update).toBe(1);
    expect(plan.summary.keep).toBe(0);
    expect(plan.removeSeriesIds).toEqual([]);
    expect(plan.ops.find((o) => o.op === "update")?.patch).toEqual({
      location: "R1",
    });
  });

  it("diff mode keeps identical slots", () => {
    const plan = planSlotDiff({
      mode: "diff",
      parsed: {
        subjects: [{ name: "OS", shortCode: "OS" }],
        slots: [
          {
            subjectShortCode: "OS",
            dayOfWeek: 1,
            start: "09:00",
            end: "10:00",
            location: "R1",
          },
        ],
      },
      existing: [
        {
          seriesId: "s1",
          subjectId: "sub1",
          shortCode: "OS",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
          location: "R1",
        },
      ],
    });
    expect(plan.summary.keep).toBe(1);
    expect(plan.summary.add).toBe(0);
  });

  it("replace mode removes series for imported subjects", () => {
    const plan = planSlotDiff({
      mode: "replace",
      parsed,
      existing: [
        {
          seriesId: "s1",
          subjectId: "sub1",
          shortCode: "OS",
          dayOfWeek: 1,
          start: "09:00",
          end: "10:00",
        },
        {
          seriesId: "s2",
          subjectId: "sub2",
          shortCode: "DSA",
          dayOfWeek: 2,
          start: "09:00",
          end: "10:00",
        },
      ],
    });
    expect(plan.removeSeriesIds).toEqual(["s1"]);
    expect(plan.summary.add).toBe(2);
    expect(plan.summary.remove).toBe(1);
  });
});

describe("slotKey", () => {
  it("normalizes shortCode case", () => {
    expect(
      slotKey({ shortCode: "os", dayOfWeek: 1, start: "09:00", end: "10:00" }),
    ).toBe(
      slotKey({ shortCode: "OS", dayOfWeek: 1, start: "09:00", end: "10:00" }),
    );
  });
});
