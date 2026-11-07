import { describe, it, expect } from "vitest";
import { evaluateApplicability } from "../../src/domain/readiness/applicability";
import { calculateNoticeReadiness } from "../../src/domain/readiness/calculate";
import {
  computePreparationTimeline,
  computeSharedFolderGroups,
  findCrossDossierLinksForRequirement,
  subtractWorkingDays,
} from "../../src/domain/readiness/intelligence";
import { ApplicantProfile, ReadinessRecord, Requirement } from "../../src/domain/types";
import {
  DEFAULT_APPLICANT_PROFILE,
  SEED_COMMUNITY_REPORTS,
  SEED_NOTICES,
} from "../../src/data/seed/notices.seed";

describe("evaluateApplicability", () => {
  const incomeReq: Requirement = {
    id: "req-income",
    code: "REQ-INC",
    title: "Income Certificate",
    category: "document",
    value: "Official income certificate",
    mandatory: true,
    applicability: {
      field: "householdIncomeLakhs",
      operator: "lte",
      expected: 3.5,
      humanLabel: "Income <= 3.5 Lakhs",
    },
    reviewState: "official",
    evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
  };

  it("returns NEEDS_REVIEW when profile field is null or undefined (never DOES_NOT_APPLY)", () => {
    const profileWithNullIncome: ApplicantProfile = {
      ...DEFAULT_APPLICANT_PROFILE,
      householdIncomeLakhs: null,
    };

    const result = evaluateApplicability(incomeReq, profileWithNullIncome);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.status).not.toBe("DOES_NOT_APPLY");
    expect(result.reason).toContain("Profile field is not specified; manual verification required");
  });

  it("returns APPLIES when profile satisfies the applicability rule", () => {
    const eligibleProfile: ApplicantProfile = {
      ...DEFAULT_APPLICANT_PROFILE,
      householdIncomeLakhs: 2.5,
    };
    const result = evaluateApplicability(incomeReq, eligibleProfile);
    expect(result.status).toBe("APPLIES");
  });

  it("returns DOES_NOT_APPLY when profile explicitly fails the condition", () => {
    const highIncomeProfile: ApplicantProfile = {
      ...DEFAULT_APPLICANT_PROFILE,
      householdIncomeLakhs: 6.0,
    };
    const result = evaluateApplicability(incomeReq, highIncomeProfile);
    expect(result.status).toBe("DOES_NOT_APPLY");
  });

  it("returns APPLIES with universal reason when requirement has no applicability rule", () => {
    const universalReq: Requirement = {
      id: "req-uni",
      code: "REQ-U",
      title: "Universal Document",
      category: "document",
      value: "Standard Form",
      mandatory: true,
      reviewState: "official",
      evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
    };
    const result = evaluateApplicability(universalReq, DEFAULT_APPLICANT_PROFILE);
    expect(result.status).toBe("APPLIES");
    expect(result.reason).toBe("Universal requirement for all applicants.");
  });
});

describe("calculateNoticeReadiness & Stale Check Invalidation", () => {
  const meritNotice = SEED_NOTICES.find((n) => n.id === "notice-merit-2026")!;
  const v1 = meritNotice.versions[0]; // v1.0

  it("calculates 100% readiness when all applicable mandatory v1.0 items are completed", () => {
    const v1Records: ReadinessRecord[] = v1.requirements
      .filter((r) => r.mandatory)
      .map((r) => ({
        noticeId: meritNotice.id,
        requirementId: r.id,
        checked: true,
        verifiedAgainstValue: r.value,
        verifiedAgainstVersion: 1,
        note: `Memo for ${r.id}`,
        updatedAt: new Date().toISOString(),
      }));

    const noticeV1 = { ...meritNotice, activeVersionNumber: 1 };
    const summary = calculateNoticeReadiness(
      noticeV1,
      DEFAULT_APPLICANT_PROFILE,
      v1Records,
      SEED_COMMUNITY_REPORTS
    );

    expect(summary.percentage).toBe(100);
    expect(summary.completedMandatoryCount).toBe(summary.totalApplicableMandatoryCount);
    expect(summary.staleReverificationCount).toBe(0);
    expect(summary.items.find((i) => i.requirement.id === "req-transcript")?.evidenceNote).toBe(
      "Memo for req-transcript"
    );
  });

  it("invalidates stale checks and transitions to needs_reverification when v2.0 modifies specification", () => {
    // Verified against v1.0 "Standard photocopy of latest semester marksheet"
    const v1Records: ReadinessRecord[] = [
      {
        noticeId: meritNotice.id,
        requirementId: "req-transcript",
        checked: true,
        verifiedAgainstValue: "Standard photocopy of latest semester marksheet",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        noticeId: meritNotice.id,
        requirementId: "req-student-id",
        checked: true,
        verifiedAgainstValue: "Both-side photocopy of valid institutional student ID card",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        noticeId: meritNotice.id,
        requirementId: "req-recommendation",
        checked: true,
        verifiedAgainstValue:
          "Signed recommendation letter from Department Head or Academic Advisor",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        noticeId: meritNotice.id,
        requirementId: "req-cgpa",
        checked: true,
        verifiedAgainstValue: "Minimum CGPA of 3.25 on a 4.00 scale",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        noticeId: meritNotice.id,
        requirementId: "req-deadline",
        checked: true,
        verifiedAgainstValue: "2026-11-15",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        noticeId: meritNotice.id,
        requirementId: "req-submission-mode",
        checked: true,
        verifiedAgainstValue: "Submit online via central scholarship portal",
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      },
    ];

    // Notice moves to v2.0 (activeVersionNumber = 3)
    const noticeV2 = { ...meritNotice, activeVersionNumber: 3 };
    const summary = calculateNoticeReadiness(
      noticeV2,
      DEFAULT_APPLICANT_PROFILE,
      v1Records,
      SEED_COMMUNITY_REPORTS
    );

    // req-transcript value in v2.0 is "Photocopy of academic marksheet strictly attested by the Controller of Examinations"
    const transcriptItem = summary.items.find(
      (item) => item.requirement.id === "req-transcript"
    );

    expect(transcriptItem).toBeDefined();
    expect(transcriptItem?.readinessStatus).toBe("needs_reverification");
    expect(transcriptItem?.previouslyVerifiedValue).toBe(
      "Standard photocopy of latest semester marksheet"
    );

    // req-deadline value in v2.0 changed from 2026-11-15 to 2026-11-25 -> also needs_reverification!
    const deadlineItem = summary.items.find(
      (item) => item.requirement.id === "req-deadline"
    );
    expect(deadlineItem?.readinessStatus).toBe("needs_reverification");

    // Total stale count should be >= 1
    expect(summary.staleReverificationCount).toBeGreaterThanOrEqual(1);

    // Stale items are excluded from the completed mandatory numerator, so readiness dropped below 100%
    expect(summary.percentage).toBeLessThan(100);

    // Check conflict detection
    expect(summary.conflictCount).toBeGreaterThanOrEqual(1);
    expect(summary.hasUnresolvedConflicts).toBe(true);
  });
});

describe("Counter-Day Timeline & Cross-Dossier Shared Folder Intelligence", () => {
  const meritNotice = SEED_NOTICES.find((n) => n.id === "notice-merit-2026")!;

  it("skips Bangladesh Friday and Saturday weekends when subtracting working days", () => {
    // 2026-11-15 is a Sunday. Subtracting 1 working day should skip Saturday (14) and Friday (13) -> Thursday 2026-11-12.
    expect(subtractWorkingDays("2026-11-15", 1)).toBe("2026-11-12");
  });

  it("computes 3-stage counter preparation timeline and latest safe start date", () => {
    const noticeV2 = { ...meritNotice, activeVersionNumber: 3 };
    const summary = calculateNoticeReadiness(noticeV2, DEFAULT_APPLICANT_PROFILE, [], []);
    const timeline = computePreparationTimeline(noticeV2, summary, new Date("2026-11-05T00:00:00Z"));

    expect(timeline.deadlineDate).toBe("2026-11-25");
    expect(timeline.totalLeadDays).toBeGreaterThan(0);
    expect(timeline.remainingLeadDays).toBe(timeline.totalLeadDays);
    expect(timeline.latestSafeStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(timeline.steps.length).toBeGreaterThanOrEqual(5);
  });

  it("groups papers from the same office across dossiers, without claiming one satisfies another", () => {
    const [university] = computeSharedFolderGroups(SEED_NOTICES, DEFAULT_APPLICANT_PROFILE, []);
    expect(university.groupId).toBe("folder-university");
    // Every member is a document (rules like a CGPA cut-off are not papers you collect).
    const reqs = SEED_NOTICES.flatMap((n) => n.versions.flatMap((v) => v.requirements));
    expect(university.peers.every((p) => reqs.find((r) => r.id === p.requirementId)?.category === "document")).toBe(true);
    // It spans dossiers: the passport's registrar certificate sits with the Merit Grant's campus papers.
    expect(new Set(university.peers.map((p) => p.noticeId)).size).toBeGreaterThan(1);
    expect(university.pendingCount).toBe(university.peers.length);

    // Checking one paper changes only that paper.
    const merit = SEED_NOTICES.find((n) => n.id === "notice-merit-2026")!;
    const transcript = merit.versions[0].requirements.find((r) => r.id === "req-transcript")!;
    const checked = [{ noticeId: merit.id, requirementId: "req-transcript", checked: true, verifiedAgainstValue: transcript.value, verifiedAgainstVersion: 1, updatedAt: "2026-11-01T00:00:00Z" }];
    const links = findCrossDossierLinksForRequirement(merit.id, "req-transcript", SEED_NOTICES, DEFAULT_APPLICANT_PROFILE, checked);
    expect(links?.self.status).toBe("completed");
    expect(links?.others.every((p) => p.status !== "completed")).toBe(true);
  });
});
