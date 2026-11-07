import { describe, it, expect } from "vitest";
import { wordDiff } from "../../src/lib/wordDiff";
import { dayDelta, formatDate } from "../../src/lib/format";

describe("wordDiff", () => {
  it("marks removed and added words around the shared ones", () => {
    const tokens = wordDiff(
      "Standard photocopy of latest semester marksheet",
      "Photocopy of academic marksheet strictly attested by the Controller of Examinations"
    );
    const rebuilt = (kind: "del" | "add") =>
      tokens.filter((t) => t.kind !== kind).map((t) => t.text).join(" ");

    // Dropping additions gives back the old sentence (case-insensitive match keeps the new casing).
    expect(rebuilt("add").toLowerCase()).toBe("standard photocopy of latest semester marksheet");
    expect(rebuilt("del")).toBe(
      "Photocopy of academic marksheet strictly attested by the Controller of Examinations"
    );
    expect(tokens.some((t) => t.kind === "del" && t.text.includes("Standard"))).toBe(true);
  });

  it("returns a single same token for identical strings", () => {
    expect(wordDiff("a b c", "a  b c")).toEqual([{ kind: "same", text: "a b c" }]);
  });
});

describe("date helpers", () => {
  it("computes signed day deltas and formats ISO dates", () => {
    expect(dayDelta("2026-11-15", "2026-11-25")).toBe(10);
    expect(dayDelta("2026-11-30", "2026-11-20")).toBe(-10);
    expect(dayDelta("6 hours", "2026-11-20")).toBeNull();
    expect(formatDate("2026-11-02")).toBe("02 Nov 2026");
  });
});
