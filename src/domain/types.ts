export type DossierCategory = "scholarship" | "internship" | "digital_service" | "public_procedure";
export type RequirementCategory = "document" | "eligibility" | "deadline" | "procedure";
export type ReviewState = "official" | "reviewed" | "needs_review" | "conflict";
export type FreshnessState = "recently_checked" | "review_due" | "source_unavailable" | "superseded";
export type ChangeType = "added" | "removed" | "modified" | "unchanged" | "unresolved";
export type ImpactLevel = "critical" | "action-needed" | "informational";
export type ApplicabilityResult = "APPLIES" | "DOES_NOT_APPLY" | "NEEDS_REVIEW";
export type ReadinessItemStatus = "pending" | "completed" | "needs_reverification";

export interface Source {
  id: string;
  authority: string;
  documentTitle: string;
  url: string;
  type: "official_portal" | "official_pdf" | "departmental_circular" | "service_terms";
  publishedAt: string;
  collectedAt: string;
  lastReviewedAt: string;
  freshness: FreshnessState;
}

export interface RequirementEvidence {
  sourceId: string;
  excerpt: string;
  sectionOrPage: string;
}

export interface ConflictDetail {
  competingSourceId: string;
  competingAuthority: string;
  competingExcerpt: string;
  resolutionGuidance: string;
}

export interface CommunityReport {
  id: string;
  noticeId: string;
  requirementId?: string;
  reportType: "requirement_changed" | "contradictory_instruction" | "service_delay" | "outdated_or_scam";
  observation: string;
  evidenceUrlOrRef: string;
  submittedAt: string;
  verificationStatus: "pending_verification" | "corroborated_pattern";
  corroborationCount: number;
}

export interface ApplicabilityRule {
  field: "studyLevel" | "currentYear" | "cgpa" | "householdIncomeLakhs" | "paymentChannel";
  operator: "equals" | "gte" | "lte";
  expected: string | number;
  humanLabel: string;
}

export interface Requirement {
  id: string;
  code: string;
  title: string;
  category: RequirementCategory;
  value: string;
  mandatory: boolean;
  isCosmeticWatchedField?: boolean;
  applicability?: ApplicabilityRule;
  reviewState: ReviewState;
  evidence: RequirementEvidence;
  conflict?: ConflictDetail;
}

export interface NoticeVersion {
  id: string;
  noticeId: string;
  versionNumber: number;
  versionLabel: string;
  publishedAt: string;
  changeSummary: string;
  requirements: Requirement[];
}

export interface Notice {
  id: string;
  slug: string;
  title: string;
  institution: string;
  departmentOrTrust: string;
  category: DossierCategory;
  zone: string;
  isFeaturedHero?: boolean;
  isIllustrativeDemo: boolean;
  activeVersionNumber: number;
  sources: Source[];
  versions: NoticeVersion[];
  systemCaveat: string;
}

export interface ApplicantProfile {
  institution: string;
  studyLevel: "undergraduate" | "masters";
  currentYear: number;
  cgpa: number;
  householdIncomeLakhs: number | null;
  paymentChannel: "bkash_nagad" | "card" | "counter";
}

export interface ReadinessRecord {
  noticeId: string;
  requirementId: string;
  checked: boolean;
  verifiedAgainstValue: string;
  verifiedAgainstVersion: number;
  updatedAt: string;
}

export interface RequirementChange {
  requirementId: string;
  code: string;
  title: string;
  category: RequirementCategory;
  type: ChangeType;
  previous?: Requirement;
  current?: Requirement;
  impact: ImpactLevel;
  deadlineDelta?: "extended" | "shortened" | "unchanged";
  explanation: string;
  applicantActionRequired: string;
}

export interface EvaluatedRequirementItem {
  requirement: Requirement;
  applicability: ApplicabilityResult;
  applicabilityReason: string;
  readinessStatus: ReadinessItemStatus;
  previouslyVerifiedValue?: string;
  latestChange?: RequirementChange;
  communityReports: CommunityReport[];
}

export interface ReadinessSummary {
  noticeId: string;
  versionLabel: string;
  percentage: number;
  completedMandatoryCount: number;
  totalApplicableMandatoryCount: number;
  staleReverificationCount: number;
  needsReviewCount: number;
  conflictCount: number;
  communityReportCount: number;
  hasUnresolvedConflicts: boolean;
  items: EvaluatedRequirementItem[];
}

