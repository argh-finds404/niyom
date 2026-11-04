import { NoticeVersion, Requirement, RequirementChange, ImpactLevel } from "../types";
import { compareDeadlines } from "./deadlines";
import { normaliseText } from "./normalise";

export function compareNoticeVersions(
  previousVersion: NoticeVersion,
  currentVersion: NoticeVersion
): RequirementChange[] {
  // Validate duplicate requirement IDs
  const prevIds = new Set<string>();
  for (const r of previousVersion.requirements) {
    if (prevIds.has(r.id)) {
      throw new Error("Duplicate requirement ID detected");
    }
    prevIds.add(r.id);
  }

  const currIds = new Set<string>();
  for (const r of currentVersion.requirements) {
    if (currIds.has(r.id)) {
      throw new Error("Duplicate requirement ID detected");
    }
    currIds.add(r.id);
  }

  const prevMap = new Map<string, Requirement>();
  previousVersion.requirements.forEach((r) => prevMap.set(r.id, r));

  const currMap = new Map<string, Requirement>();
  currentVersion.requirements.forEach((r) => currMap.set(r.id, r));

  const changes: RequirementChange[] = [];

  // Check current version requirements against previous
  for (const current of currentVersion.requirements) {
    const previous = prevMap.get(current.id);

    if (!previous) {
      // Added
      const impact: ImpactLevel = current.mandatory ? "critical" : "action-needed";
      changes.push({
        requirementId: current.id,
        code: current.code,
        title: current.title,
        category: current.category,
        type: "added",
        current,
        impact,
        explanation: current.mandatory
          ? `New mandatory requirement added: "${current.title}".`
          : `New optional requirement added: "${current.title}".`,
        applicantActionRequired: current.mandatory
          ? "Fulfill and document this mandatory requirement before application submission."
          : "Review optional criterion to determine whether to include in submission.",
      });
      continue;
    }

    // Check if modified or unchanged
    const isValueChanged = normaliseText(previous.value) !== normaliseText(current.value);
    const isMandatoryChanged = previous.mandatory !== current.mandatory;
    const isTitleChanged = previous.title !== current.title;
    const isCategoryChanged = previous.category !== current.category;
    const isReviewStateChanged = previous.reviewState !== current.reviewState;
    const isApplicabilityChanged =
      JSON.stringify(previous.applicability) !== JSON.stringify(current.applicability);
    const isConflictChanged =
      JSON.stringify(previous.conflict) !== JSON.stringify(current.conflict);

    const isModified =
      isValueChanged ||
      isMandatoryChanged ||
      isTitleChanged ||
      isCategoryChanged ||
      isReviewStateChanged ||
      isApplicabilityChanged ||
      isConflictChanged;

    if (!isModified) {
      changes.push({
        requirementId: current.id,
        code: current.code,
        title: current.title,
        category: current.category,
        type: "unchanged",
        previous,
        current,
        impact: "informational",
        deadlineDelta:
          current.category === "deadline" ? "unchanged" : undefined,
        explanation: `Requirement "${current.title}" remains unchanged from version ${previousVersion.versionLabel}.`,
        applicantActionRequired: "No further modification required.",
      });
      continue;
    }

    // Modified requirement classification
    const isCosmetic = Boolean(current.isCosmeticWatchedField || previous.isCosmeticWatchedField);

    let impact: ImpactLevel = "action-needed";
    let explanation = `Requirement "${current.title}" updated in version ${currentVersion.versionLabel}.`;
    let applicantActionRequired = "Review updated specification and update documentation.";
    let deadlineDelta: "extended" | "shortened" | "unchanged" | undefined = undefined;

    if (isCosmetic) {
      impact = "informational";
      explanation = "Administrative or contact details changed with zero impact on application readiness.";
      applicantActionRequired = "Take note of administrative contact information update.";
    } else if (!previous.mandatory && current.mandatory) {
      impact = "critical";
      explanation = `Requirement "${current.title}" escalated from Optional to Mandatory in ${currentVersion.versionLabel}.`;
      applicantActionRequired = "Action required: Fulfill newly mandatory requirement to maintain eligibility.";
    } else if (current.category === "deadline" || previous.category === "deadline") {
      deadlineDelta = compareDeadlines(previous.value, current.value);
      if (deadlineDelta === "shortened") {
        impact = "critical";
        explanation = `Deadline shortened from ${previous.value} to ${current.value}.`;
        applicantActionRequired = "Urgent: Expedite preparation to submit before the earlier deadline.";
      } else if (deadlineDelta === "extended") {
        impact = "action-needed";
        explanation = `Deadline extended from ${previous.value} to ${current.value}.`;
        applicantActionRequired = "Adjust timeline to accommodate the extended submission deadline.";
      } else {
        impact = "informational";
        explanation = `Deadline re-confirmed as ${current.value}.`;
        applicantActionRequired = "No timeline change required.";
      }
    } else if (current.mandatory) {
      impact = "critical";
      explanation = `Mandatory requirement specification modified: "${current.title}".`;
      applicantActionRequired = "Re-verify existing documentation against updated mandatory specifications.";
    } else {
      impact = "action-needed";
      explanation = `Requirement specification modified: "${current.title}".`;
      applicantActionRequired = "Review updated details and adjust submission dossier.";
    }

    changes.push({
      requirementId: current.id,
      code: current.code,
      title: current.title,
      category: current.category,
      type: "modified",
      previous,
      current,
      impact,
      deadlineDelta,
      explanation,
      applicantActionRequired,
    });
  }

  // Check for removed requirements (present in previous but absent in current)
  for (const previous of previousVersion.requirements) {
    if (!currMap.has(previous.id)) {
      changes.push({
        requirementId: previous.id,
        code: previous.code,
        title: previous.title,
        category: previous.category,
        type: "removed",
        previous,
        impact: "action-needed",
        explanation: `Requirement "${previous.title}" was removed or superseded in version ${currentVersion.versionLabel}.`,
        applicantActionRequired:
          "Verify against official circular/source before omitting this item from your dossier.",
      });
    }
  }

  return changes;
}

