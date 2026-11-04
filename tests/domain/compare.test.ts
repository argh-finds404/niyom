import { describe, it, expect } from "vitest";
import { compareNoticeVersions } from "../../src/domain/comparison/compare";
import { compareDeadlines } from "../../src/domain/comparison/deadlines";
import { NoticeVersion, Requirement } from "../../src/domain/types";
import { SEED_NOTICES } from "../../src/data/seed/notices.seed";

describe("compareNoticeVersions", () => {
  const meritNotice = SEED_NOTICES.find((n) => n.id === "notice-merit-2026")!;
  const v1 = meritNotice.versions[0]; // v1.0
  const v11 = meritNotice.versions[1]; // v1.1
  const v2 = meritNotice.versions[2]; // v2.0

  it("detects added, removed, modified, and unchanged requirements accurately", () => {
    const baseReq1: Requirement = {
      id: "req-1",
      code: "R1",
      title: "Title 1",
      category: "document",
      value: "Value 1",
      mandatory: true,
      reviewState: "official",
      evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
    };
    const baseReq2: Requirement = {
      id: "req-2",
      code: "R2",
      title: "Title 2",
      category: "document",
      value: "Value 2",
      mandatory: false,
      reviewState: "official",
      evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
    };
    const baseReq3: Requirement = {
      id: "req-3",
      code: "R3",
      title: "Title 3",
      category: "procedure",
      value: "Original Value 3",
      mandatory: true,
      reviewState: "official",
      evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
    };

    const prevVersion: NoticeVersion = {
      id: "v-prev",
      noticeId: "n-test",
      versionNumber: 1,
      versionLabel: "v1.0",
      publishedAt: "2026-10-01",
      changeSummary: "prev",
      requirements: [baseReq1, baseReq2, baseReq3],
    };

    const nextReq3Modified: Requirement = {
      ...baseReq3,
      value: "Updated Value 3",
    };
    const nextReq4Added: Requirement = {
      id: "req-4",
      code: "R4",
      title: "Title 4 Added",
      category: "document",
      value: "Value 4",
      mandatory: true,
      reviewState: "official",
      evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
    };

    const nextVersion: NoticeVersion = {
      id: "v-next",
      noticeId: "n-test",
      versionNumber: 2,
      versionLabel: "v2.0",
      publishedAt: "2026-10-15",
      changeSummary: "next",
      // req-1 is unchanged, req-2 is removed (omitted), req-3 is modified, req-4 is added
      requirements: [baseReq1, nextReq3Modified, nextReq4Added],
    };

    const changes = compareNoticeVersions(prevVersion, nextVersion);

    const unchanged = changes.find((c) => c.requirementId === "req-1");
    const removed = changes.find((c) => c.requirementId === "req-2");
    const modified = changes.find((c) => c.requirementId === "req-3");
    const added = changes.find((c) => c.requirementId === "req-4");

    expect(unchanged).toBeDefined();
    expect(unchanged?.type).toBe("unchanged");

    expect(removed).toBeDefined();
    expect(removed?.type).toBe("removed");
    expect(removed?.impact).toBe("action-needed");

    expect(modified).toBeDefined();
    expect(modified?.type).toBe("modified");
    expect(modified?.impact).toBe("critical");

    expect(added).toBeDefined();
    expect(added?.type).toBe("added");
    expect(added?.impact).toBe("critical");
  });

  it("classifies Optional -> Mandatory escalation as critical", () => {
    // In merit grant v1.0 -> v2.0, req-income-cert was mandatory: false -> mandatory: true
    const changes = compareNoticeVersions(v1, v2);
    const incomeCertChange = changes.find((c) => c.requirementId === "req-income-cert");

    expect(incomeCertChange).toBeDefined();
    expect(incomeCertChange?.type).toBe("modified");
    expect(incomeCertChange?.impact).toBe("critical");
    expect(incomeCertChange?.explanation).toContain("escalated from Optional to Mandatory");
  });

  it("classifies cosmetic change (req-helpdesk in v1.0 -> v1.1) as informational", () => {
    const changes = compareNoticeVersions(v1, v11);
    const helpdeskChange = changes.find((c) => c.requirementId === "req-helpdesk");

    expect(helpdeskChange).toBeDefined();
    expect(helpdeskChange?.type).toBe("modified");
    expect(helpdeskChange?.impact).toBe("informational");
    expect(helpdeskChange?.explanation).toContain("Administrative or contact details changed");
  });

  it("detects extended vs shortened deadlines accurately", () => {
    expect(compareDeadlines("2026-11-15", "2026-11-25")).toBe("extended");
    expect(compareDeadlines("2026-11-30", "2026-11-20")).toBe("shortened");
    expect(compareDeadlines("2026-11-15", "2026-11-15")).toBe("unchanged");

    // In Merit Notice v1.0 -> v2.0, deadline extended from 2026-11-15 to 2026-11-25
    const changes = compareNoticeVersions(v1, v2);
    const deadlineChange = changes.find((c) => c.requirementId === "req-deadline");
    expect(deadlineChange?.deadlineDelta).toBe("extended");
    expect(deadlineChange?.impact).toBe("action-needed");

    // In ICT internship v1.0 -> v2.0, deadline shortened from 2026-11-30 to 2026-11-20
    const ictNotice = SEED_NOTICES.find((n) => n.id === "notice-ict-internship")!;
    const ictChanges = compareNoticeVersions(ictNotice.versions[0], ictNotice.versions[1]);
    const ictDeadlineChange = ictChanges.find((c) => c.requirementId === "req-ict-deadline");
    expect(ictDeadlineChange?.deadlineDelta).toBe("shortened");
    expect(ictDeadlineChange?.impact).toBe("critical");
  });

  it("throws an explicit Error('Duplicate requirement ID detected') on duplicate requirement IDs", () => {
    const duplicateVersion: NoticeVersion = {
      id: "v-dup",
      noticeId: "n-dup",
      versionNumber: 1,
      versionLabel: "v1.0",
      publishedAt: "2026-10-01",
      changeSummary: "duplicate",
      requirements: [
        {
          id: "duplicate-id",
          code: "R1",
          title: "First",
          category: "document",
          value: "V1",
          mandatory: true,
          reviewState: "official",
          evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
        },
        {
          id: "duplicate-id",
          code: "R2",
          title: "Second with same ID",
          category: "document",
          value: "V2",
          mandatory: true,
          reviewState: "official",
          evidence: { sourceId: "s1", excerpt: "ex", sectionOrPage: "p1" },
        },
      ],
    };

    expect(() => compareNoticeVersions(duplicateVersion, v1)).toThrow(
      "Duplicate requirement ID detected"
    );
    expect(() => compareNoticeVersions(v1, duplicateVersion)).toThrow(
      "Duplicate requirement ID detected"
    );
  });
});

