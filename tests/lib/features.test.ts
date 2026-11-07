import { describe, it, expect } from "vitest";
import { SEED_NOTICES } from "../../src/data/seed/notices.seed";
import { deriveAlerts } from "../../src/lib/alerts";
import { buildDeadlineIcs } from "../../src/lib/ics";
import { daysUntil, deadlineOf } from "../../src/lib/deadline";

const seedSeen = Object.fromEntries(SEED_NOTICES.map((n) => [n.id, n.activeVersionNumber]));

describe("deriveAlerts", () => {
  it("raises nothing on the seed, and one alert when the merit grant moves to v2.0", () => {
    expect(deriveAlerts(SEED_NOTICES, {}, [], {}, seedSeen)).toEqual([]);

    const moved = SEED_NOTICES.map((n) => (n.id === "notice-merit-2026" ? { ...n, activeVersionNumber: 3 } : n));
    const alerts = deriveAlerts(moved, { "notice-merit-2026": 1 }, [], { "notice-merit-2026": 2 }, seedSeen);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ noticeId: "notice-merit-2026", fromVersion: 1, toVersion: 3, staleChecks: 2 });
    // v1.0 → v2.0: transcript, income certificate, submission channel (critical) + deadline (action needed).
    expect(alerts[0].consequential).toBe(4);
    expect(alerts[0].cosmetic).toBe(1);
  });

  it("stays quiet for notices you unfollowed or already reviewed", () => {
    const moved = SEED_NOTICES.map((n) => (n.id === "notice-merit-2026" ? { ...n, activeVersionNumber: 3 } : n));
    expect(deriveAlerts(moved, { "notice-merit-2026": 1 }, ["notice-merit-2026"], {}, seedSeen)).toEqual([]);
    expect(deriveAlerts(moved, { "notice-merit-2026": 3 }, [], {}, seedSeen)).toEqual([]);
  });
});

describe("deadlines", () => {
  it("finds dated deadlines and counts days", () => {
    const merit = SEED_NOTICES[0];
    expect(deadlineOf(merit.versions[2])?.date).toBe("2026-11-25");
    const railway = SEED_NOTICES.find((n) => n.id === "service-railway-refund")!;
    expect(deadlineOf(railway.versions[1])).toBeNull();
    expect(daysUntil("2026-11-25", new Date(2026, 10, 4))).toBe(21);
  });

  it("builds a valid all-day iCalendar event", () => {
    const ics = buildDeadlineIcs({
      uid: "x@niyom",
      title: "Merit Grant 2026, application closes",
      date: "2026-11-25",
      description: "Line one; with, punctuation",
      now: new Date("2026-11-04T10:00:00Z"),
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261125");
    expect(ics).toContain("DTEND;VALUE=DATE:20261126");
    expect(ics).toContain("DTSTAMP:20261104T100000Z");
    expect(ics).toContain("SUMMARY:Merit Grant 2026\\, application closes");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
