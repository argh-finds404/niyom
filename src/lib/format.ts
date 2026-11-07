import type {
  ApplicabilityResult,
  ApplicantProfile,
  DossierCategory,
  FreshnessState,
  ImpactLevel,
  Notice,
  RequirementCategory,
  RequirementChange,
  ReviewState,
} from "@/domain/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-02" → "02 Nov 2026". Non-ISO strings are returned as-is. */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/** Signed whole-day difference between two ISO dates, or null when either is not a date. */
export function dayDelta(from: string | undefined, to: string | undefined): number | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function versionTag(label: string): string {
  return label.split(" ")[0];
}

export const CATEGORY_LABEL: Record<DossierCategory, string> = {
  scholarship: "Scholarship",
  digital_service: "Digital service",
  internship: "Internship",
  public_procedure: "Public procedure",
};

export const REQUIREMENT_GROUPS: { id: RequirementCategory; label: string; blurb: string }[] = [
  { id: "document", label: "Documents", blurb: "Papers you must carry or upload." },
  { id: "eligibility", label: "Eligibility", blurb: "Conditions checked against your profile." },
  { id: "deadline", label: "Deadlines", blurb: "Dates that close the application window." },
  { id: "procedure", label: "Procedures", blurb: "How and where the submission happens." },
];

export const APPLICABILITY_LABEL: Record<ApplicabilityResult, string> = {
  APPLIES: "Applies to you",
  DOES_NOT_APPLY: "Exempt",
  NEEDS_REVIEW: "Needs profile review",
};

export const REVIEW_LABEL: Record<ReviewState, string> = {
  official: "Official",
  reviewed: "Reviewed",
  needs_review: "Needs review",
  conflict: "Source conflict",
};

export const FRESHNESS_LABEL: Record<FreshnessState, string> = {
  recently_checked: "Recently checked",
  review_due: "Review due",
  source_unavailable: "Source unavailable",
  superseded: "Superseded",
};

export const IMPACT_LABEL: Record<ImpactLevel, string> = {
  critical: "Critical",
  "action-needed": "Action needed",
  informational: "Informational",
};

export const REPORT_TYPE_LABEL = {
  requirement_changed: "Requirement changed",
  contradictory_instruction: "Contradictory instruction",
  service_delay: "Service delay",
  outdated_or_scam: "Outdated or scam notice",
} as const;

/** A change counts as consequential when it is not cosmetic and not unchanged. */
export function isConsequential(c: RequirementChange): boolean {
  return c.type !== "unchanged" && c.impact !== "informational";
}

export function isCosmetic(c: RequirementChange): boolean {
  return c.type !== "unchanged" && c.impact === "informational";
}

export function shortInstitution(name: string): string {
  const paren = /\(([^)]+)\)\s*$/.exec(name);
  return paren ? paren[1] : name;
}

export const CHANNEL_LABEL: Record<ApplicantProfile["paymentChannel"], string> = {
  bkash_nagad: "bKash / Nagad",
  card: "Card",
  counter: "Station counter",
};

export function formatIncome(lakhs: number | null): string {
  return lakhs === null ? "Not stated" : `${lakhs.toFixed(2)}L BDT`;
}

export function profileLine(p: ApplicantProfile): string[] {
  return [
    shortInstitution(p.institution),
    `${p.studyLevel === "undergraduate" ? "B.Sc." : "M.Sc."} Year ${p.currentYear}`,
    `CGPA ${p.cgpa.toFixed(2)}`,
    `Income ${formatIncome(p.householdIncomeLakhs)}`,
    CHANNEL_LABEL[p.paymentChannel],
  ];
}

export function shortTitle(n: Notice): string {
  const map: Record<string, string> = {
    "notice-merit-2026": "Merit Grant 2026",
    "service-railway-refund": "Railway e-ticket refund",
    "notice-ict-internship": "ICT SE Fellowship 2026",
    "procedure-epassport-rajshahi": "e-Passport checklist",
  };
  return map[n.id] ?? n.title;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
