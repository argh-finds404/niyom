import {
  Notice,
  ApplicantProfile,
  ReadinessRecord,
  CommunityReport,
  ReadinessSummary,
  EvaluatedRequirementItem,
  ReadinessItemStatus,
} from "../types";
import { compareNoticeVersions } from "../comparison/compare";
import { normaliseText } from "../comparison/normalise";
import { evaluateApplicability } from "./applicability";

export function calculateNoticeReadiness(
  notice: Notice,
  profile: ApplicantProfile,
  records: ReadinessRecord[],
  communityReports: CommunityReport[]
): ReadinessSummary {
  const activeVersion =
    notice.versions.find((v) => v.versionNumber === notice.activeVersionNumber) ||
    notice.versions[0];

  const changeMap = new Map();
  if (notice.activeVersionNumber > 1 && notice.versions.length > 1) {
    const v1 = notice.versions[0];
    const changes = compareNoticeVersions(v1, activeVersion);
    for (const change of changes) {
      changeMap.set(change.requirementId, change);
    }
  }

  const noticeReports = communityReports.filter((r) => r.noticeId === notice.id);
  const noticeRecords = new Map<string, ReadinessRecord>();
  records
    .filter((r) => r.noticeId === notice.id)
    .forEach((r) => noticeRecords.set(r.requirementId, r));

  const items: EvaluatedRequirementItem[] = [];
  let completedMandatoryCount = 0;
  let totalApplicableMandatoryCount = 0;
  let staleReverificationCount = 0;
  let needsReviewCount = 0;
  let conflictCount = 0;

  for (const req of activeVersion.requirements) {
    const appResult = evaluateApplicability(req, profile);
    const record = noticeRecords.get(req.id);

    let readinessStatus: ReadinessItemStatus = "pending";
    let previouslyVerifiedValue: string | undefined = undefined;

    if (record && record.checked) {
      previouslyVerifiedValue = record.verifiedAgainstValue;
      if (normaliseText(record.verifiedAgainstValue) !== normaliseText(req.value)) {
        readinessStatus = "needs_reverification";
      } else {
        readinessStatus = "completed";
      }
    }

    if (readinessStatus === "needs_reverification") {
      staleReverificationCount += 1;
    }

    if (req.reviewState === "conflict") {
      conflictCount += 1;
    }

    if (appResult.status === "NEEDS_REVIEW" || req.reviewState === "needs_review") {
      needsReviewCount += 1;
    }

    const isApplicableMandatory = req.mandatory && appResult.status === "APPLIES";
    if (isApplicableMandatory) {
      totalApplicableMandatoryCount += 1;
      if (readinessStatus === "completed") {
        completedMandatoryCount += 1;
      }
    }

    const reqReports = noticeReports.filter((r) => r.requirementId === req.id);

    items.push({
      requirement: req,
      applicability: appResult.status,
      applicabilityReason: appResult.reason,
      readinessStatus,
      previouslyVerifiedValue,
      evidenceNote: record?.note || undefined,
      latestChange: changeMap.get(req.id),
      communityReports: reqReports,
    });
  }

  const percentage =
    totalApplicableMandatoryCount > 0
      ? Math.round((completedMandatoryCount / totalApplicableMandatoryCount) * 100)
      : 100;

  return {
    noticeId: notice.id,
    versionLabel: activeVersion.versionLabel,
    percentage,
    completedMandatoryCount,
    totalApplicableMandatoryCount,
    staleReverificationCount,
    needsReviewCount,
    conflictCount,
    communityReportCount: noticeReports.length,
    hasUnresolvedConflicts: conflictCount > 0,
    items,
  };
}

/** The checks of an applicant who prepared every required paper of the original notice. */
export function checksForOriginal(notice: Notice, updatedAt: string): ReadinessRecord[] {
  const original = notice.versions[0];
  return original.requirements
    .filter((r) => r.mandatory)
    .map((r) => ({
      noticeId: notice.id,
      requirementId: r.id,
      checked: true,
      verifiedAgainstValue: r.value,
      verifiedAgainstVersion: original.versionNumber,
      updatedAt,
    }));
}

/**
 * What a version does to an applicant who had prepared everything for the original notice.
 * Their checks stay as they were, so a changed requirement turns stale and a new one is still to do.
 */
export function readinessIfPreparedForOriginal(notice: Notice, versionNumber: number, profile: ApplicantProfile): ReadinessSummary {
  return calculateNoticeReadiness({ ...notice, activeVersionNumber: versionNumber }, profile, checksForOriginal(notice, notice.versions[0].publishedAt), []);
}
