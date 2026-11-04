NIYOM — Master Initialization, Core Engine & Git Security Spec (Phase A)You are the Principal Systems, Build & Git Infrastructure Engineer for NIYOM ("Be ready. Not just informed."), a Personal Application Readiness & Requirement Intelligence platform built for the Credosis Phase 02 Frontend Engineer Intern evaluation.Your mission is to execute Steps 0 through 9 in one continuous, error-free run:Maintain a live progress tracker in NIYOM_EXECUTION_LOG.md so the user can inspect every completed step.Lock Git authorship strictly to Shoumik Orgho (orghodutta@gmail.com) and install three Git hooks (commit-msg, pre-commit, and pre-push) that strip any AI Co-Authored-By: Claude trailers, block unauthorized identities, and prevent Claude Code from pushing to GitHub.Initialize the Next.js (App Router) + TypeScript + Tailwind CSS project and install all required dependencies.Implement the complete, pure TypeScript Requirement Intelligence Engine (src/domain/), the 4-dossier Bangladesh seed dataset (src/data/seed/), SSR-safe IndexedDB persistence (src/data/persistence/), the Zustand store (src/hooks/useNiyomStore.ts), and the Vitest unit test suite (tests/).Verify that npm run typecheck, npm test, and npm run build pass with 0 errors, then commit and push the foundation to GitHub exclusively under Shoumik Orgho.CRITICAL BOUNDARY & GIT AUTHORSHIP RULES (NON-NEGOTIABLE)NO UI DESIGN OR STYLING: Do not build visual UI cards, sidebars, or custom CSS themes. Create only minimal, valid Next.js route placeholders (<main>) so next build succeeds. Claude Opus 5.5 will build the visual presentation layer in Phase B on top of your tested domain contracts.EXCLUSIVE GIT IDENTITY: Every commit in this repository must be authored and committed strictly by:Name: Shoumik OrghoEmail: orghodutta@gmail.comZero AI Attribution: Never add Co-Authored-By: trailers or mention AI tools in commit messages.CLAUDE PUSH LOCK (pre-push hook): Claude Code is strictly forbidden from pushing to GitHub. Only Antigravity (when instructed by the user) or the user directly may push.STEP 0: Create and Maintain NIYOM_EXECUTION_LOG.mdImmediately create NIYOM_EXECUTION_LOG.md in the workspace root with the checklist below. As you complete each step, update [ ] to [x] with a timestamp and verification note:# NIYOM — Phase A Execution & Verification Log
- **Lead Engineer**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Repository**: `niyom`
- **Architecture**: Modular Monolith (Pure TypeScript Domain Engine + Zustand + Dexie IndexedDB + Next.js App Router)

## Execution Progress
- [ ] **Step 0**: Execution Log Initialized
- [ ] **Step 1**: Next.js Project Scaffolded & Dependencies Installed (`zod`, `zustand`, `dexie`, `lucide-react`, `vitest`)
- [ ] **Step 2**: Git Identity Locked (`Shoumik Orgho <orghodutta@gmail.com>`) & Git Hooks Installed (`commit-msg`, `pre-commit`, `pre-push`)
- [ ] **Step 3**: Modular Directory Tree, Font Setup (`Geist`, `Geist_Mono`, `Inter`) & `cn()` Utility Created
- [ ] **Step 4**: Canonical TypeScript Domain Contracts (`src/domain/types.ts`) & Zod Schemas (`src/domain/schemas.ts`) Implemented
- [ ] **Step 5**: Deterministic Comparison, Deadline Delta, Applicability & Readiness Engine Implemented (`src/domain/`)
- [ ] **Step 6**: 4-Dossier Bangladesh Seed Dataset Implemented (`src/data/seed/notices.seed.ts`)
- [ ] **Step 7**: SSR-Safe Dexie IndexedDB Wrapper (`src/data/persistence/db.ts`) & Zustand Store (`src/hooks/useNiyomStore.ts`) Implemented
- [ ] **Step 8**: Next.js 15+ Async Route Placeholders & Vitest Unit Test Suite Created (`tests/domain/`)
- [ ] **Step 9**: Verification Gate Passed (`typecheck`, `test`, `build` = 0 errors) & Pushed to GitHub
(Also add ANTIGRAVITY_INIT.md and NIYOM_EXECUTION_LOG.md to .gitignore before the final commit if you want the public GitHub repo clean, OR keep NIYOM_EXECUTION_LOG.md locally on disk so the user can read it!)STEP 1: Initialize Next.js & Install All DependenciesCheck if package.json already exists in the current directory.If not, run:npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
(Fallback Safeguard: If create-next-app . fails because the current directory contains NIYOM_EXECUTION_LOG.md, ANTIGRAVITY_INIT.md, or capital letters in the folder name, run npx create-next-app@latest niyom-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes, move all files and hidden dotfiles from niyom-app into the workspace root, delete niyom-app, and set "name": "niyom" in package.json.)Install runtime packages:npm install zod zustand dexie lucide-react clsx tailwind-merge
Install testing and path-resolution packages:npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
Update package.json "scripts" to this exact block:"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
Create vitest.config.mts in the workspace root:import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
Update NIYOM_EXECUTION_LOG.md: Mark Step 1 [x].STEP 2: Lock Git Identity & Install Anti-Claude Git HooksInitialize Git (if .git does not exist) and lock local repository authorship:git init
git config user.name "Shoumik Orgho"
git config user.email "orghodutta@gmail.com"
Create a tracked .githooks/ directory (and also copy them into .git/hooks/) and configure git config core.hooksPath .githooks so the rules cannot be bypassed:File 1: .githooks/pre-commit (Forces Git author & committer to Shoumik Orgho <orghodutta@gmail.com> and blocks any other identity):#!/bin/sh
AUTHOR_NAME=$(git config user.name)
AUTHOR_EMAIL=$(git config user.email)

if [ "$AUTHOR_NAME" != "Shoumik Orgho" ] || [ "$AUTHOR_EMAIL" != "orghodutta@gmail.com" ]; then
  echo "❌ [GIT GUARD]: Commit blocked. Adjusting git config to Shoumik Orgho <orghodutta@gmail.com>..."
  git config user.name "Shoumik Orgho"
  git config user.email "orghodutta@gmail.com"
fi

if [ -n "$GIT_AUTHOR_EMAIL" ] && [ "$GIT_AUTHOR_EMAIL" != "orghodutta@gmail.com" ]; then
  echo "❌ [GIT GUARD]: Unauthorized GIT_AUTHOR_EMAIL ($GIT_AUTHOR_EMAIL) blocked."
  exit 1
fi
exit 0
File 2: .githooks/commit-msg (Automatically strips any Co-Authored-By: or Claude attribution lines so Claude NEVER appears as a contributor on GitHub):#!/bin/sh
COMMIT_MSG_FILE=$1
# Remove any Co-Authored-By lines or AI attribution lines automatically
grep -ivE "Co-Authored-By:|Generated with Claude|anthropic\.com" "$COMMIT_MSG_FILE" > "${COMMIT_MSG_FILE}.clean"
mv "${COMMIT_MSG_FILE}.clean" "$COMMIT_MSG_FILE"
exit 0
File 3: .githooks/pre-push (Verifies every commit on the branch belongs exclusively to Shoumik Orgho <orghodutta@gmail.com> and blocks pushes unless NIYOM_ALLOW_PUSH=1 is set by Antigravity or the user):#!/bin/sh
BAD_COMMITS=$(git log -n 20 --pretty=format:"%h %an <%ae>" | grep -v "Shoumik Orgho <orghodutta@gmail.com>" || true)
if [ -n "$BAD_COMMITS" ]; then
  echo "❌ [GIT GUARD]: Push rejected! Found commits not authored by Shoumik Orgho <orghodutta@gmail.com>:"
  echo "$BAD_COMMITS"
  exit 1
fi

if [ "$CLAUDECODE" = "1" ] || [ -n "$CLAUDE_CODE_ENTRYPOINT" ]; then
  echo "❌ [GIT GUARD]: Claude Code is strictly prohibited from running git push."
  exit 1
fi
exit 0
Activate the hooks:git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/commit-msg .githooks/pre-push || true
Update NIYOM_EXECUTION_LOG.md: Mark Step 2 [x].STEP 3: Create Modular Directory Tree, Utility & FontsCreate this directory structure:src/
├── app/
│   ├── explore/
│   ├── notice/[id]/
│   ├── changes/[id]/
│   └── my-plan/
├── components/
│   ├── layout/
│   ├── ledger/
│   └── ui/
├── domain/
│   ├── comparison/
│   └── readiness/
├── data/
│   ├── seed/
│   └── persistence/
├── hooks/
└── lib/
tests/
└── domain/
Create src/lib/utils.ts:import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
Update src/app/layout.tsx to load Geist, Geist_Mono, and Inter from next/font/google with variables --font-geist-sans, --font-geist-mono, and --font-inter, and set metadata:title: "NIYOM — Personal Application Readiness & Requirement Intelligence"description: "Be ready. Not just informed. Requirement intelligence and version-aware preparation plans."Update NIYOM_EXECUTION_LOG.md: Mark Step 3 [x].STEP 4: Canonical Domain Contracts (src/domain/types.ts & src/domain/schemas.ts)Create src/domain/types.ts with these exact exported types:export type DossierCategory = "scholarship" | "internship" | "digital_service" | "public_procedure";
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
Create src/domain/schemas.ts with Zod validation schemas (applicantProfileSchema, communityReportInputSchema, readinessRecordSchema).Update NIYOM_EXECUTION_LOG.md: Mark Step 4 [x].STEP 5: Deterministic Domain Engine (src/domain/comparison/ & src/domain/readiness/)src/domain/comparison/normalise.ts:Export normaliseText(value: string): string (trims, collapses multiple whitespace characters into single spaces, and lowercases).src/domain/comparison/deadlines.ts:Export compareDeadlines(previousDateStr: string, currentDateStr: string): "extended" | "shortened" | "unchanged" (parses YYYY-MM-DD timestamps reliably in UTC).src/domain/comparison/compare.ts:Export compareNoticeVersions(previousVersion: NoticeVersion, currentVersion: NoticeVersion): RequirementChange[].Throw an explicit Error("Duplicate requirement ID detected") if either version contains duplicate Requirement.ids.Match requirements across versions using stable id.Classify impact deterministically:If isCosmeticWatchedField === true $\rightarrow$ impact: "informational", explaining that administrative/contact details changed with zero impact on application readiness.If type === "added" and current.mandatory === true $\rightarrow$ impact: "critical".If type === "added" and !current.mandatory $\rightarrow$ impact: "action-needed".If type === "modified" where !previous.mandatory && current.mandatory $\rightarrow$ impact: "critical" (escalated from Optional to Mandatory).If category === "deadline" $\rightarrow$ "shortened" is "critical", "extended" is "action-needed".If type === "modified" on a mandatory requirement $\rightarrow$ impact: "critical".If type === "removed" $\rightarrow$ impact: "action-needed" (warn applicant to verify against official source before discarding).src/domain/readiness/applicability.ts:Export evaluateApplicability(req: Requirement, profile: ApplicantProfile): { status: ApplicabilityResult; reason: string }.If !req.applicability, return { status: "APPLIES", reason: "Universal requirement for all applicants." }.If profile[req.applicability.field] is null or undefined, MUST return { status: "NEEDS_REVIEW", reason: "Profile field is not specified; manual verification required." } (NEVER return DOES_NOT_APPLY when profile information is missing).Otherwise evaluate equals, gte, and lte deterministically.src/domain/readiness/calculate.ts:Export calculateNoticeReadiness(notice: Notice, profile: ApplicantProfile, records: ReadinessRecord[], communityReports: CommunityReport[]): ReadinessSummary.Find the active NoticeVersion matching notice.activeVersionNumber. If notice.activeVersionNumber > 1, compare against Version 1 (versions[0]) to attach latestChange context.For each requirement:If no matching ReadinessRecord or !record.checked $\rightarrow$ readinessStatus = "pending".If record.checked AND normaliseText(record.verifiedAgainstValue) !== normaliseText(req.value) $\rightarrow$ readinessStatus = "needs_reverification" (Stale check detected because the requirement changed in a newer notice version!).If record.checked and normalized values match $\rightarrow$ readinessStatus = "completed".Calculate percentage over requirements where req.mandatory === true && applicability === "APPLIES". Only "completed" items count in the numerator; "needs_reverification" items are excluded from the numerator until re-confirmed.Update NIYOM_EXECUTION_LOG.md: Mark Step 5 [x].STEP 6: 4-Dossier Bangladesh Seed Dataset (src/data/seed/notices.seed.ts)Export SEED_NOTICES: Notice[], DEFAULT_APPLICANT_PROFILE: ApplicantProfile, and SEED_COMMUNITY_REPORTS: CommunityReport[] covering all 4 Phase 01 scenarios:Dossier 1 (id: "notice-merit-2026", Category: "scholarship", isFeaturedHero: true):Bangladesh University Merit & Research Grant 2026 (Institution: Higher Education & Research Commission / PMEAT Division).3 Versions:v1.0 (versionNumber: 1, 2026-10-15):req-transcript (REQ-DOC-01): Mandatory Document, "Standard photocopy of latest semester marksheet".req-student-id (REQ-DOC-02): Mandatory Document, "Both-side photocopy of valid institutional student ID card".req-recommendation (REQ-DOC-03): Mandatory Document, "Signed recommendation letter from Department Head or Academic Advisor".req-income-cert (REQ-DOC-04): Optional Document (mandatory: false), "Optional supporting income statement for need-priority tier", Applicability: householdIncomeLakhs <= 3.5.req-cgpa (REQ-ELG-01): Mandatory Eligibility, "Minimum CGPA of 3.25 on a 4.00 scale", Applicability: cgpa >= 3.25.req-deadline (REQ-DLN-01): Mandatory Deadline, "2026-11-15".req-submission-mode (REQ-PRC-01): Mandatory Procedure, "Submit online via central scholarship portal".req-helpdesk (REQ-PRC-02): Optional Procedure (isCosmeticWatchedField: true), "Email queries to grant-support@hed.gov.bd (Room 108)".v1.1 (versionNumber: 2, 2026-10-22 — Cosmetic Update Only):Identical to v1.0 except req-helpdesk changes to "Email queries to scholarship-cell@hed.gov.bd (Annex Building Room 302)".v2.0 (versionNumber: 3, 2026-11-02 — Major Corrigendum):req-transcript modified to "Photocopy of academic marksheet strictly attested by the Controller of Examinations" (Invalidates v1.0 preparation!).req-income-cert escalated from Optional to Mandatory (mandatory: true), value changed to "Mandatory official annual income certificate signed by UNO or Ward Commissioner".req-deadline extended from "2026-11-15" to "2026-11-25".req-submission-mode marked reviewState: "conflict" with conflict details showing that while the Central Portal states "Online submission only", the University Registrar Circular (Memo #RUET/Acad/2026-89) states "Submit 1 printed hardcopy dossier to Registrar Room 204".Dossier 2 (id: "service-railway-refund", Category: "digital_service", isFeaturedHero: true):Bangladesh Railway (Shohoz) Online Ticket Cancellation & Refund Procedure.2 Versions (v1.0 standard policy vs v2.0 updated OTP & online portal refund verification rules) + Official Cross-Source Conflict on refund processing timeline (Shohoz Homepage FAQ states 5–7 working days for bKash/Nagad and 7–10 working days for cards, while the Cancellation Policy page states up to 10 business days) + Pre-seeded Community Reports showing corroborated patterns of 12–14 business day delays on bkash_nagad channel refunds, paired with systemCaveat: "NIYOM does not have access to individual PNR transactions. It separates published Shohoz/Railway refund policies from independently reported passenger delay patterns."Dossier 3 (id: "notice-ict-internship", Category: "internship"):ICT Division Undergraduate Software Engineering Fellowship & Internship 2026 (2 versions showing added GitHub repository verification requirement and shortened deadline warning).Dossier 4 (id: "procedure-epassport-rajshahi", Category: "public_procedure"):Department of Immigration & Passports — Regional e-Passport Student Verification Checklist (Rajshahi / National) (2 versions showing NID/Birth Registration and student enrollment certificate requirements).Update NIYOM_EXECUTION_LOG.md: Mark Step 6 [x].STEP 7: SSR-Safe Dexie Persistence & Zustand Store (src/data/persistence/db.ts & src/hooks/useNiyomStore.ts)src/data/persistence/db.ts:Guard all IndexedDB/Dexie creation with typeof window !== "undefined" so Next.js SSR prerendering never crashes.Provide async helper methods to load and save profile, readinessRecords, communityReports, and activeVersions.src/hooks/useNiyomStore.ts:Boot synchronously from SEED_NOTICES, DEFAULT_APPLICANT_PROFILE, and SEED_COMMUNITY_REPORTS so SSR and initial render have zero flash, then hydrate persisted IndexedDB state on client mount.Export useNiyomStore with:notices: Notice[]activeNoticeId: string (default "notice-merit-2026")profile: ApplicantProfilereadinessRecords: ReadinessRecord[]communityReports: CommunityReport[]demoScenarioStage: "v1_ready" | "v2_updated" | "custom"isHydrated: booleanActions:hydrateFromStorage(): Promise<void>setActiveNotice(noticeId: string): voidsetNoticeActiveVersion(noticeId: string, versionNumber: number): voidtoggleRequirementCheck(noticeId: string, requirement: Requirement, versionNumber: number): voidreverifyRequirement(noticeId: string, requirement: Requirement, versionNumber: number): voidupdateProfile(partial: Partial<ApplicantProfile>): voidsubmitCommunityReport(report: Omit<CommunityReport, "id" | "submittedAt" | "verificationStatus" | "corroborationCount">): voidloadScenarioV1Ready(): void (Sets notice-merit-2026 to activeVersionNumber = 1 and marks all applicable mandatory v1.0 requirements completed against their v1.0 values $\rightarrow$ Readiness = 100%).simulateV2UpdateArrival(): void (Ensures v1.0 items are checked, then sets notice-merit-2026 to activeVersionNumber = 3 [v2.0], automatically turning req-transcript into needs_reverification and injecting mandatory req-income-cert).resetDemoData(): voidUpdate NIYOM_EXECUTION_LOG.md: Mark Step 7 [x].STEP 8: Next.js 15+ Route Placeholders & Vitest Unit TestsCreate minimal, valid semantic <main> route placeholders (using params: Promise<{ id: string }> on dynamic routes for Next.js 15/16 compatibility):src/app/page.tsxsrc/app/explore/page.tsxsrc/app/notice/[id]/page.tsxsrc/app/changes/[id]/page.tsxsrc/app/my-plan/page.tsxCreate unit tests in tests/domain/compare.test.ts and tests/domain/readiness.test.ts (explicitly importing { describe, it, expect } from "vitest"):Test added, removed, modified, and unchanged requirement detection.Test Optional $\rightarrow$ Mandatory escalation classified as critical.Test Cosmetic change (req-helpdesk in v1.0 -> v1.1) classified as informational.Test extended vs. shortened deadline detection.Test duplicate requirement ID validation throws an error.Test missing profile field (householdIncomeLakhs: null) returns NEEDS_REVIEW, never DOES_NOT_APPLY.Test stale check invalidation (completed under v1.0 automatically transitions to needs_reverification when v2.0 modifies the requirement specification, and readiness percentage updates accurately).Update NIYOM_EXECUTION_LOG.md: Mark Step 8 [x].STEP 9: Mandatory Verification Gate, Git Commit & PushRun all three verification checks and fix any issues until all three pass with 0 errors:npm run typecheck
npm test
npm run build
Update NIYOM_EXECUTION_LOG.md to mark Step 9 [x] and record the test & build summary.Stage and commit all files strictly under Shoumik Orgho (orghodutta@gmail.com) with no AI trailers:git add .
git -c user.name="Shoumik Orgho" -c user.email="orghodutta@gmail.com" commit -m "feat(core): initialize NIYOM requirement intelligence engine, seed dossiers, persistence, and unit tests"
Verify commit authorship:git log -1 --pretty=format:"%h - %an <%ae> : %s"
(Must output: Shoumik Orgho <orghodutta@gmail.com>)If a remote origin is already configured, push the branch (git push -u origin main). If no remote URL is configured yet, check if gh CLI is authenticated (gh repo status) or report in NIYOM_EXECUTION_LOG.md that the commit is verified and ready for git remote add origin <url> && git push -u origin main.