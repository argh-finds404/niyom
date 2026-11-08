import { describe, expect, it } from "vitest";
import { DEFAULT_APPLICANT_PROFILE, SEED_NOTICES } from "../../src/data/seed/notices.seed";
import { checksForOriginal, readinessIfPreparedForOriginal } from "../../src/domain/readiness/calculate";

/*
 * The Overview hero shows what each published version does to an applicant who had prepared
 * every required paper for the original notice. These figures come from the readiness engine;
 * nothing in the interface is hard-coded. A change to the seed data or the engine shows up here.
 */
const at = (id: string, version: number) => {
  const notice = SEED_NOTICES.find((n) => n.id === id)!;
  const s = readinessIfPreparedForOriginal(notice, version, DEFAULT_APPLICANT_PROFILE);
  return { percent: s.percentage, ready: s.completedMandatoryCount, of: s.totalApplicableMandatoryCount, stale: s.staleReverificationCount };
};

describe("readiness of an applicant prepared for the original notice", () => {
  it("is complete on the original of every dossier", () => {
    for (const n of SEED_NOTICES) expect(at(n.id, n.versions[0].versionNumber).percent).toBe(100);
  });

  it("ignores a cosmetic update (Merit Grant, Update 1 only moves a helpdesk room)", () => {
    expect(at("notice-merit-2026", 2)).toEqual({ percent: 100, ready: 6, of: 6, stale: 0 });
  });

  it("drops by what each update really changes", () => {
    // Two prepared papers changed and the income certificate became required: 4 of 7.
    expect(at("notice-merit-2026", 3)).toEqual({ percent: 57, ready: 4, of: 7, stale: 2 });
    // A new rule (SMS two-factor) only adds a paper; nothing prepared turns stale.
    expect(at("service-railway-refund", 2)).toEqual({ percent: 80, ready: 4, of: 5, stale: 0 });
    // The deadline moved and a GitHub portfolio was added.
    expect(at("notice-ict-internship", 2)).toEqual({ percent: 60, ready: 3, of: 5, stale: 1 });
    // The identity document wording changed and an enrolment certificate was added.
    expect(at("procedure-epassport-rajshahi", 2)).toEqual({ percent: 50, ready: 2, of: 4, stale: 1 });
  });

  it("checks only the required papers of the original, against their original wording", () => {
    const merit = SEED_NOTICES.find((n) => n.id === "notice-merit-2026")!;
    const checks = checksForOriginal(merit, "2026-10-20T00:00:00.000Z");
    expect(checks).toHaveLength(merit.versions[0].requirements.filter((r) => r.mandatory).length);
    expect(checks.every((c) => c.checked && c.verifiedAgainstVersion === 1)).toBe(true);
  });
});
