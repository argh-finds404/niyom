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
    memoPresets: ["UNO Certificate #2026/119", "Ward-04 Signed Copy in Folder"],
  }),
  "req-transcript": (v) => ({
    office: v >= 3 ? "Controller of Examinations" : "Departmental Photocopy Desk",
    leadDays: v >= 3 ? 2 : 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: v >= 3 ? "e.g. Attested by Controller · Reg #CE/884" : "e.g. Marksheet photocopy · Sem 7",
    memoPresets: v >= 3 ? ["Controller Attested · Reg #CE/884", "Dept Forwarding + Controller Seal"] : ["Standard Photocopy · Sem 7"],
  }),
  "req-recommendation": () => ({
    office: "Department Head / Advisor Office",
    leadDays: 2,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Signed by Prof. Dr. M. Rahman · CSE",
    memoPresets: ["Signed by Dept Head · Sealed", "Advisor Letter in Envelope"],
  }),
  "req-student-id": () => ({
    office: "University Registrar / Hall Office",
    leadDays: 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Student ID #2003042 · Both sides copied",
    memoPresets: ["ID #2003042 · Both sides copied", "Valid through Dec 2026"],
  }),
  "req-cgpa": () => ({
    office: "Academic Transcript Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. Verified CGPA 3.78 / 4.00",
    memoPresets: ["CGPA 3.78 verified on transcript"],
  }),
  "req-submission-mode": () => ({
    office: "Central Portal & Registrar Rm 204",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Portal Ack #MERIT-9921 + Rm 204 Receipt",
    memoPresets: ["Portal PDF ready + 1 hardcopy printed", "Submitted to Rm 204"],
  }),
  "req-deadline": () => ({
    office: "Central Scholarship Portal",
    leadDays: 0,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Target upload: 3 days before closing",
    memoPresets: ["Calendar reminder set (-3 days)"],
  }),
  "req-pnr-status": () => ({
    office: "Rail Sheba / Shohoz Portal",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. PNR 6582910421 · Suborno Express",
    memoPresets: ["PNR 6582910421 · Registered SIM active"],
  }),
  "req-otp-auth": () => ({
    office: "Registered Mobile SIM (OTP)",
    leadDays: 0,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. OTP verified on SIM +88017••••••",
    memoPresets: ["Primary SIM in handset for 120s OTP"],
  }),
  "req-cancel-window": () => ({
    office: "Rail Sheba Cancellation Gate",
    leadDays: 0,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Cancelled 14 hours before departure",
    memoPresets: ["Cancelled > 6h before departure"],
  }),
  "req-refund-timeline": () => ({
    office: "Shohoz / MFS Settlement Queue",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. bKash TrxID #9J8219KDA · Filed 28 Oct",
    memoPresets: ["bKash TrxID #9J8219KDA", "Cancellation SMS saved"],
  }),
  "req-refund-wallet": () => ({
    office: "bKash / Nagad Originating Wallet",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. bKash wallet active · KYC verified",
    memoPresets: ["Originating bKash wallet active"],
  }),
  "req-ict-study": () => ({
    office: "University Enrollment Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. B.Sc. Year 4 · Semester 7",
    memoPresets: ["B.Sc. Year 4 enrollment verified"],
  }),
  "req-ict-cgpa": () => ({
    office: "Academic Transcript Record",
    leadDays: 0,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. CGPA 3.78 >= 3.00 cut-off",
    memoPresets: ["CGPA 3.78 >= 3.00"],
  }),
  "req-ict-cv": () => ({
    office: "Technical Portfolio Preparation",
    leadDays: 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. 2-page PDF CV exported · sha256 verified",
    memoPresets: ["2-page Technical CV PDF ready"],
  }),
  "req-ict-github": () => ({
    office: "GitHub Public Repositories",
    leadDays: 2,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. github.com/shoumik · 2 repos pinned with README",
    memoPresets: ["2 public repos pinned with README"],
  }),
  "req-ict-deadline": () => ({
    office: "ICT Division Fellowship Portal",
    leadDays: 0,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Submit before Nov 20 closing",
    memoPresets: ["Reminder set for Nov 17"],
  }),
  "req-pass-nid": () => ({
    office: "BRIS / Election Commission NID",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. Smart NID #8294018291 (original + copy)",
    memoPresets: ["Smart NID original + photocopy", "17-digit English BRIS verified"],
  }),
  "req-pass-fee": () => ({
    office: "Sonali Bank / Automated A-Challan",
    leadDays: 1,
    stage: 1,
    stageLabel: "Civic & Treasury",
    memoPlaceholder: "e.g. A-Challan #2610-8849201 · 4,025 BDT paid",
    memoPresets: ["A-Challan #2610-8849201 verified"],
  }),
  "req-pass-student-cert": () => ({
    office: "University Dean / Registrar Office",
    leadDays: 3,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Registrar GO Memo #RUET/Reg/412",
    memoPresets: ["Registrar Student Certificate #412"],
  }),
  "req-pass-biometrics": () => ({
    office: "Regional Passport Office (RPO) Counter",
    leadDays: 1,
    stage: 3,
    stageLabel: "Final Submission",
    memoPlaceholder: "e.g. Appointment Slot: RPO Rajshahi Counter 3",
    memoPresets: ["Application summary printed for RPO"],
  }),
};

function defaultOfficeMeta(): RequirementOfficeMeta {
  return {
    office: "Issuing Authority Desk",
    leadDays: 1,
    stage: 2,
    stageLabel: "Institutional Attestation",
    memoPlaceholder: "e.g. Reference number, receipt ID, or folder note",
    memoPresets: ["Document verified and placed in folder"],
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
  today: Date = new Date()
): PreparationTimeline {
  const vNum = notice.activeVersionNumber;
  const activeVersion = notice.versions.find((v) => v.versionNumber === vNum) ?? notice.versions[0];
  const deadlineReq = activeVersion.requirements.find(
    (r) => r.category === "deadline" && /^\d{4}-\d{2}-\d{2}$/.test(r.value)
  );
  const deadlineDate = deadlineReq?.value ?? null;

  const applicableMandatory = summary.items.filter(
    (i) => i.requirement.mandatory && i.applicability === "APPLIES"
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

/* ───────────── 2. Cross-Dossier Document Reuse ("Shared Physical Folder") ───────────── */

export interface CrossDossierPeer {
  noticeId: string;
  noticeTitle: string;
  requirementId: string;
  code: string;
  title: string;
  value: string;
  strictnessRank: number;
  strictnessLabel: string;
  status: EvaluatedRequirementItem["readinessStatus"] | "exempt";
  evidenceNote?: string;
}

export interface SharedFolderGroup {
  groupId: string;
  folderItemTitle: string;
  description: string;
  peers: CrossDossierPeer[];
  highestVerifiedRank: number;
  highestRequiredRank: number;
  reusableCount: number;
  blockedCount: number;
}

interface SharedSpec {
  groupId: string;
  folderItemTitle: string;
  description: string;
  members: {
    noticeId: string;
    requirementId: string;
    rank: (versionNumber: number, value: string) => { rank: number; label: string };
  }[];
}

const SHARED_FOLDER_SPECS: SharedSpec[] = [
  {
    groupId: "folder-academic-standing",
    folderItemTitle: "Academic Transcript & CGPA Proof",
    description:
      "Your official university marksheet and CGPA standing used across scholarship and fellowship applications.",
    members: [
      {
        noticeId: "notice-merit-2026",
        requirementId: "req-transcript",
        rank: (v, val) =>
          v >= 3 || val.toLowerCase().includes("controller")
            ? { rank: 3, label: "Controller of Examinations attested" }
            : { rank: 1, label: "Standard unattested photocopy" },
      },
      {
        noticeId: "notice-merit-2026",
        requirementId: "req-cgpa",
        rank: () => ({ rank: 2, label: "CGPA >= 3.25 threshold" }),
      },
      {
        noticeId: "notice-ict-internship",
        requirementId: "req-ict-cgpa",
        rank: () => ({ rank: 1, label: "CGPA >= 3.00 threshold" }),
      },
      {
        noticeId: "notice-ict-internship",
        requirementId: "req-ict-cv",
        rank: () => ({ rank: 2, label: "2-page technical CV & coursework transcript" }),
      },
    ],
  },
  {
    groupId: "folder-student-enrollment",
    folderItemTitle: "University Student ID & Enrollment Certificate",
    description:
      "Proof of active university enrollment required by scholarship boards, fellowship wings, and regional passport counters.",
    members: [
      {
        noticeId: "notice-merit-2026",
        requirementId: "req-student-id",
        rank: () => ({ rank: 1, label: "Both-side Student ID photocopy" }),
      },
      {
        noticeId: "notice-ict-internship",
        requirementId: "req-ict-study",
        rank: () => ({ rank: 1, label: "Undergraduate Year 3/4 standing" }),
      },
      {
        noticeId: "procedure-epassport-rajshahi",
        requirementId: "req-pass-student-cert",
        rank: () => ({ rank: 3, label: "Dean / Registrar attested enrollment certificate" }),
      },
    ],
  },
  {
    groupId: "folder-payment-voucher",
    folderItemTitle: "Digital Payment & Treasury Voucher (bKash / A-Challan)",
    description:
      "Verified mobile financial wallet (bKash/Nagad) and treasury receipt records kept for fee verification and refund claims.",
    members: [
      {
        noticeId: "service-railway-refund",
        requirementId: "req-refund-wallet",
        rank: () => ({ rank: 2, label: "Active originating bKash/Nagad wallet" }),
      },
      {
        noticeId: "service-railway-refund",
        requirementId: "req-refund-timeline",
        rank: () => ({ rank: 2, label: "Saved TrxID & cancellation SMS" }),
      },
      {
        noticeId: "procedure-epassport-rajshahi",
        requirementId: "req-pass-fee",
        rank: () => ({ rank: 2, label: "Verified A-Challan / Sonali Bank slip" }),
      },
    ],
  },
];

export function computeSharedFolderGroups(
  notices: Notice[],
  profile: ApplicantProfile,
  records: ReadinessRecord[]
): SharedFolderGroup[] {
  const summaries = new Map<string, ReadinessSummary>();
  for (const n of notices) {
    summaries.set(n.id, calculateNoticeReadiness(n, profile, records, []));
  }

  return SHARED_FOLDER_SPECS.map((spec): SharedFolderGroup => {
    const peers: CrossDossierPeer[] = [];
    for (const m of spec.members) {
      const notice = notices.find((n) => n.id === m.noticeId);
      const summary = summaries.get(m.noticeId);
      if (!notice || !summary) continue;
      const item = summary.items.find((i) => i.requirement.id === m.requirementId);
      if (!item) continue;
      const { rank, label } = m.rank(notice.activeVersionNumber, item.requirement.value);
      peers.push({
        noticeId: notice.id,
        noticeTitle: notice.title,
        requirementId: item.requirement.id,
        code: item.requirement.code,
        title: item.requirement.title,
        value: item.requirement.value,
        strictnessRank: rank,
        strictnessLabel: label,
        status: item.applicability === "DOES_NOT_APPLY" ? "exempt" : item.readinessStatus,
        evidenceNote: item.evidenceNote,
      });
    }

    const activePeers = peers.filter((p) => p.status !== "exempt");
    const verifiedPeers = activePeers.filter((p) => p.status === "completed");
    const highestVerifiedRank = verifiedPeers.reduce((max, p) => Math.max(max, p.strictnessRank), 0);
    const highestRequiredRank = activePeers.reduce((max, p) => Math.max(max, p.strictnessRank), 0);

    return {
      groupId: spec.groupId,
      folderItemTitle: spec.folderItemTitle,
      description: spec.description,
      peers,
      highestVerifiedRank,
      highestRequiredRank,
      reusableCount: verifiedPeers.length,
      blockedCount: activePeers.filter((p) => p.status !== "completed").length,
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
  const groups = computeSharedFolderGroups(notices, profile, records);
  for (const group of groups) {
    const self = group.peers.find((p) => p.noticeId === noticeId && p.requirementId === requirementId);
    if (self) {
      const others = group.peers.filter((p) => !(p.noticeId === noticeId && p.requirementId === requirementId));
      return { group, self, others };
    }
  }
  return null;
}

