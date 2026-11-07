import type { ApplicantProfile, EvaluatedRequirementItem, Notice, ReadinessRecord, ReadinessSummary } from "../types";
import { calculateNoticeReadiness } from "./calculate";

/* ───────────── 1. Office Lead-Time & Counter Sequence Intelligence ───────────── */

export interface RequirementOfficeMeta {
  office: string;
  leadDays: number;
  stage: 1 | 2 | 3;
  stageLabel: "Civic & Treasury" | "Institutional Attestation" | "Final Submission";
  memoPlaceholder: string;
  memoPresets: string[];
}

export interface PreparationStep {
  requirementId: string;
  code: string;
  title: string;
  mandatory: boolean;
  office: string;
  leadDays: number;
  stage: 1 | 2 | 3;
  stageLabel: "Civic & Treasury" | "Institutional Attestation" | "Final Submission";
  status: "completed" | "needs_reverification" | "pending";
  evidenceNote?: string;
  memoPlaceholder: string;
  memoPresets: string[];
}

export interface PreparationTimeline {
  noticeId: string;
  versionNumber: number;
  deadlineDate: string | null;
  totalLeadDays: number;
  completedLeadDays: number;
  remainingLeadDays: number;
  latestSafeStartDate: string | null;
  bufferDaysRemaining: number | null;
  scheduleStatus: "complete" | "on_track" | "tight" | "behind" | "no_dated_deadline";
  steps: PreparationStep[];
}

const OFFICE_META: Record<string, (versionNumber: number) => RequirementOfficeMeta> = {
  "req-income-cert": () => ({
    office: "UNO / Ward Commissioner Office",
    leadDays: 3,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. Ward-04 Memo #2026/119 · Signed 04 Nov",
    memoPresets: ["Original certificate in folder", "Applied at the ward office"],
  }),
  "req-transcript": (v) => ({
    office: v >= 3 ? "Controller of Examinations" : "Departmental Photocopy Desk",
    leadDays: v >= 3 ? 2 : 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: v >= 3 ? "e.g. Attested by Controller · Reg #CE/884" : "e.g. Marksheet photocopy · Sem 7",
    memoPresets: v >= 3 ? ["Attested copy in folder", "Sent for attestation"] : ["Photocopy in folder"],
  }),
  "req-recommendation": () => ({
    office: "Department Head / Advisor Office",
    leadDays: 2,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Signed by Prof. Dr. M. Rahman · CSE",
    memoPresets: ["Signed letter in a sealed envelope", "Requested from my advisor"],
  }),
  "req-student-id": () => ({
    office: "University Registrar / Hall Office",
    leadDays: 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Student ID #2003042 · Both sides copied",
    memoPresets: ["Both sides photocopied", "Card valid past the deadline"],
  }),
  "req-cgpa": () => ({
    office: "Academic Transcript Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. Verified CGPA 3.78 / 4.00",
    memoPresets: ["CGPA confirmed on my transcript"],
  }),
  "req-submission-mode": () => ({
    office: "Central Portal & Registrar Rm 204",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Portal Ack #MERIT-9921 + Rm 204 Receipt",
    memoPresets: ["Portal PDF ready", "Hard copy printed"],
  }),
  "req-deadline": () => ({
    office: "Central Scholarship Portal",
    leadDays: 0,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Target upload: 3 days before closing",
    memoPresets: ["Reminder set three days before"],
  }),
  "req-pnr-status": () => ({
    office: "Rail Sheba / Shohoz Portal",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. PNR 6582910421 · Suborno Express",
    memoPresets: ["PNR saved, registered SIM active"],
  }),
  "req-otp-auth": () => ({
    office: "Registered Mobile SIM (OTP)",
    leadDays: 0,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. OTP verified on SIM +88017••••••",
    memoPresets: ["Registered SIM in my phone"],
  }),
  "req-cancel-window": () => ({
    office: "Rail Sheba Cancellation Gate",
    leadDays: 0,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Cancelled 14 hours before departure",
    memoPresets: ["Cancelled inside the window"],
  }),
  "req-refund-timeline": () => ({
    office: "Shohoz / MFS Settlement Queue",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. bKash TrxID #9J8219KDA · Filed 28 Oct",
    memoPresets: ["Transaction ID saved", "Cancellation SMS saved"],
  }),
  "req-refund-wallet": () => ({
    office: "bKash / Nagad Originating Wallet",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. bKash wallet active · KYC verified",
    memoPresets: ["Originating wallet active"],
  }),
  "req-ict-study": () => ({
    office: "University Enrollment Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. B.Sc. Year 4 · Semester 7",
    memoPresets: ["Enrollment year confirmed"],
  }),
  "req-ict-cgpa": () => ({
    office: "Academic Transcript Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. CGPA 3.78 >= 3.00 cut-off",
    memoPresets: ["CGPA confirmed on my transcript"],
  }),
  "req-ict-cv": () => ({
    office: "Technical Portfolio Preparation",
    leadDays: 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. 2-page PDF CV exported · sha256 verified",
    memoPresets: ["Two-page PDF ready"],
  }),
  "req-ict-github": () => ({
    office: "GitHub Public Repositories",
    leadDays: 2,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. github.com/yourname · 2 repos pinned with README",
    memoPresets: ["Repositories pinned with a README"],
  }),
  "req-ict-deadline": () => ({
    office: "ICT Division Fellowship Portal",
    leadDays: 0,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Submit before Nov 20 closing",
    memoPresets: ["Reminder set three days before"],
  }),
  "req-pass-nid": () => ({
    office: "BRIS / Election Commission NID",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. Smart NID #8294018291 (original + copy)",
    memoPresets: ["Original and photocopy in folder"],
  }),
  "req-pass-fee": () => ({
    office: "Sonali Bank / Automated A-Challan",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. A-Challan #2610-8849201 · 4,025 BDT paid",
    memoPresets: ["Challan paid, receipt printed"],
  }),
  "req-pass-student-cert": () => ({
    office: "University Dean / Registrar Office",
    leadDays: 3,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Registrar GO Memo #RUET/Reg/412",
    memoPresets: ["Certificate collected from the registrar"],
  }),
  "req-pass-biometrics": () => ({
    office: "Regional Passport Office (RPO) Counter",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Appointment Slot: RPO Rajshahi Counter 3",
    memoPresets: ["Application summary printed"],
  }),
};

/** No office data: nothing to visit, and nothing is invented (office is empty). */
function defaultOfficeMeta(): RequirementOfficeMeta {
  return {
    office: "",
    leadDays: 0,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Reference number, receipt ID, or folder note",
    memoPresets: ["Original in folder"],
  };
}

export function getRequirementOfficeMeta(requirementId: string, versionNumber = 1): RequirementOfficeMeta {
  return OFFICE_META[requirementId]?.(versionNumber) ?? defaultOfficeMeta();
}

/**
 * Subtracts Bangladesh working days (Sunday–Thursday; skips Friday=5 and Saturday=6)
 * from an ISO deadline date (`YYYY-MM-DD`).
 */
export function subtractWorkingDays(deadlineIso: string, workingDays: number): string {
  const d = new Date(`${deadlineIso}T00:00:00Z`);
  let remaining = Math.max(0, Math.ceil(workingDays));
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    // In Bangladesh, Friday (5) and Saturday (6) are government/university weekend days.
    if (day !== 5 && day !== 6) {
      remaining -= 1;
    }
  }
  return d.toISOString().slice(0, 10);
}

export function computePreparationTimeline(
  notice: Notice,
  summary: ReadinessSummary,
  /** Pass the current date; without one, nothing that depends on today is computed. */
  today?: Date
): PreparationTimeline {
  const vNum = notice.activeVersionNumber;
  const activeVersion = notice.versions.find((v) => v.versionNumber === vNum) ?? notice.versions[0];
  const deadlineReq = activeVersion.requirements.find(
    (r) => r.category === "deadline" && /^\d{4}-\d{2}-\d{2}$/.test(r.value)
  );
  const deadlineDate = deadlineReq?.value ?? null;

  // Only papers and procedures take time at a counter; eligibility rules and the deadline itself are not visits.
  const applicableMandatory = summary.items.filter(
    (i) =>
      i.requirement.mandatory &&
      i.applicability === "APPLIES" &&
      (i.requirement.category === "document" || i.requirement.category === "procedure")
  );

  const steps: PreparationStep[] = applicableMandatory
    .map((item): PreparationStep => {
      const meta = getRequirementOfficeMeta(item.requirement.id, vNum);
      return {
        requirementId: item.requirement.id,
        code: item.requirement.code,
        title: item.requirement.title,
        mandatory: item.requirement.mandatory,
        office: meta.office,
        leadDays: meta.leadDays,
        stage: meta.stage,
        stageLabel: meta.stageLabel,
        status: item.readinessStatus,
        evidenceNote: item.evidenceNote,
        memoPlaceholder: meta.memoPlaceholder,
        memoPresets: meta.memoPresets,
      };
    })
    .sort((a, b) => a.stage - b.stage || b.leadDays - a.leadDays);

  const totalLeadDays = steps.reduce((acc, s) => acc + s.leadDays, 0);
  const completedLeadDays = steps
    .filter((s) => s.status === "completed")
    .reduce((acc, s) => acc + s.leadDays, 0);
  const remainingLeadDays = steps
    .filter((s) => s.status !== "completed")
    .reduce((acc, s) => acc + s.leadDays, 0);

  if (!deadlineDate) {
    return {
      noticeId: notice.id,
      versionNumber: vNum,
      deadlineDate: null,
      totalLeadDays,
      completedLeadDays,
      remainingLeadDays,
      latestSafeStartDate: null,
      bufferDaysRemaining: null,
      scheduleStatus: remainingLeadDays === 0 ? "complete" : "no_dated_deadline",
      steps,
    };
  }

  const latestSafeStartDate = subtractWorkingDays(deadlineDate, remainingLeadDays);
  if (!today) {
    return {
      noticeId: notice.id,
      versionNumber: vNum,
      deadlineDate,
      totalLeadDays,
      completedLeadDays,
      remainingLeadDays,
      latestSafeStartDate,
      bufferDaysRemaining: null,
      scheduleStatus: remainingLeadDays === 0 ? "complete" : "on_track",
      steps,
    };
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const safeStartUtc = Date.parse(`${latestSafeStartDate}T00:00:00Z`);
  const bufferDaysRemaining = Math.round((safeStartUtc - todayUtc) / 86_400_000);

  const scheduleStatus: PreparationTimeline["scheduleStatus"] =
    remainingLeadDays === 0
      ? "complete"
      : bufferDaysRemaining < 0
        ? "behind"
        : bufferDaysRemaining <= 3
          ? "tight"
          : "on_track";

  return {
    noticeId: notice.id,
    versionNumber: vNum,
    deadlineDate,
    totalLeadDays,
    completedLeadDays,
    remainingLeadDays,
    latestSafeStartDate,
    bufferDaysRemaining,
    scheduleStatus,
    steps,
  };
}

/* ───────────── 2. Collect together: papers from the same place, across dossiers ───────────── */

/*
 * Different dossiers sometimes need papers issued by the same office. They are still different
 * documents (a student ID photocopy is not a registrar's enrollment certificate), so NIYOM never
 * says one satisfies another. It only groups them so one visit can collect them all.
 */

export interface CrossDossierPeer {
  noticeId: string;
  noticeTitle: string;
  requirementId: string;
  code: string;
  title: string;
  value: string;
  status: EvaluatedRequirementItem["readinessStatus"] | "exempt";
  evidenceNote?: string;
}

export interface SharedFolderGroup {
  groupId: string;
  title: string;
  description: string;
  peers: CrossDossierPeer[];
  readyCount: number;
  pendingCount: number;
}

const SHARED_FOLDER_SPECS: { groupId: string; title: string; description: string; members: { noticeId: string; requirementId: string }[] }[] = [
  {
    groupId: "folder-university",
    title: "Papers from your university",
    description: "Each is a different document and needs its own check, but all of them come from your campus, so one visit can collect them.",
    members: [
      { noticeId: "notice-merit-2026", requirementId: "req-transcript" },
      { noticeId: "notice-merit-2026", requirementId: "req-student-id" },
      { noticeId: "notice-merit-2026", requirementId: "req-recommendation" },
      { noticeId: "procedure-epassport-rajshahi", requirementId: "req-pass-student-cert" },
    ],
  },
];

export function computeSharedFolderGroups(notices: Notice[], profile: ApplicantProfile, records: ReadinessRecord[]): SharedFolderGroup[] {
  const summaries = new Map(notices.map((n) => [n.id, calculateNoticeReadiness(n, profile, records, [])] as const));
  return SHARED_FOLDER_SPECS.map((spec) => {
    const peers: CrossDossierPeer[] = [];
    for (const m of spec.members) {
      const notice = notices.find((n) => n.id === m.noticeId);
      const item = summaries.get(m.noticeId)?.items.find((i) => i.requirement.id === m.requirementId);
      if (!notice || !item) continue; // not in the version this device follows
      peers.push({
        noticeId: notice.id,
        noticeTitle: notice.title,
        requirementId: item.requirement.id,
        code: item.requirement.code,
        title: item.requirement.title,
        value: item.requirement.value,
        status: item.applicability === "DOES_NOT_APPLY" ? "exempt" : item.readinessStatus,
        evidenceNote: item.evidenceNote,
      });
    }
    const active = peers.filter((p) => p.status !== "exempt");
    return {
      groupId: spec.groupId,
      title: spec.title,
      description: spec.description,
      peers,
      readyCount: active.filter((p) => p.status === "completed").length,
      pendingCount: active.filter((p) => p.status !== "completed").length,
    };
  });
}

export function findCrossDossierLinksForRequirement(
  noticeId: string,
  requirementId: string,
  notices: Notice[],
  profile: ApplicantProfile,
  records: ReadinessRecord[]
): { group: SharedFolderGroup; self: CrossDossierPeer; others: CrossDossierPeer[] } | null {
  for (const group of computeSharedFolderGroups(notices, profile, records)) {
    const self = group.peers.find((p) => p.noticeId === noticeId && p.requirementId === requirementId);
    if (self) return { group, self, others: group.peers.filter((p) => p !== self) };
  }
  return null;
}
