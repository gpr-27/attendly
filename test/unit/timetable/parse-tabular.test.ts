import { describe, expect, it } from "vitest";
import { parseTimetableCsv } from "@/lib/timetable/parse-tabular";

describe("parseTimetableCsv", () => {
  it("parses headered CSV with day names", () => {
    const csv = [
      "shortCode,name,day,start,end,location",
      "DSA,Data Structures,Mon,09:00,10:00,A101",
      "OS,Operating Systems,Wed,11:00,12:00,Lab 2",
    ].join("\n");

    const result = parseTimetableCsv(csv);
    expect(result.subjects).toHaveLength(2);
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0]).toMatchObject({
      subjectShortCode: "DSA",
      dayOfWeek: 1,
      start: "09:00",
      end: "10:00",
      location: "A101",
    });
    expect(result.slots[1]?.dayOfWeek).toBe(3);
  });

  it("parses headerless rows", () => {
    const csv = "ALG,Algorithms,1,09:00,10:00,B2";
    const result = parseTimetableCsv(csv);
    expect(result.subjects[0]?.shortCode).toBe("ALG");
    expect(result.slots[0]?.dayOfWeek).toBe(1);
  });

  it("rejects empty input", () => {
    expect(() => parseTimetableCsv("")).toThrow(/empty/i);
  });
});
