import { ApplicantProfile, ApplicabilityResult, Requirement } from "../types";

export function evaluateApplicability(
  req: Requirement,
  profile: ApplicantProfile
): { status: ApplicabilityResult; reason: string } {
  if (!req.applicability) {
    return {
      status: "APPLIES",
      reason: "Universal requirement for all applicants.",
    };
  }

  const { field, operator, expected, humanLabel } = req.applicability;
  const profileVal = profile[field];

  if (profileVal === null || profileVal === undefined) {
    return {
      status: "NEEDS_REVIEW",
      reason: "Profile field is not specified; manual verification required.",
    };
  }

  let matches = false;
  switch (operator) {
    case "equals":
      matches = String(profileVal) === String(expected);
      break;
    case "gte":
      matches = Number(profileVal) >= Number(expected);
      break;
    case "lte":
      matches = Number(profileVal) <= Number(expected);
      break;
    default:
      matches = false;
  }

  if (matches) {
    return {
      status: "APPLIES",
      reason: `Profile satisfies requirement criterion (${humanLabel}).`,
    };
  }

  return {
    status: "DOES_NOT_APPLY",
    reason: `Profile does not match condition (${humanLabel}).`,
  };
}

