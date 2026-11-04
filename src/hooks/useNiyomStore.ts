import { create } from "zustand";
import {
  ApplicantProfile,
  CommunityReport,
  Notice,
  ReadinessRecord,
  Requirement,
} from "../domain/types";
import {
  DEFAULT_APPLICANT_PROFILE,
  SEED_COMMUNITY_REPORTS,
  SEED_NOTICES,
} from "../data/seed/notices.seed";
import {
  clearPersistedData,
  loadPersistedState,
  persistActiveVersion,
  persistAllReadinessRecords,
  persistCommunityReport,
  persistProfile,
  persistReadinessRecord,
} from "../data/persistence/db";

export interface NiyomStoreState {
  notices: Notice[];
  activeNoticeId: string;
  profile: ApplicantProfile;
  readinessRecords: ReadinessRecord[];
  communityReports: CommunityReport[];
  demoScenarioStage: "v1_ready" | "v2_updated" | "custom";
  isHydrated: boolean;

  // Actions
  hydrateFromStorage: () => Promise<void>;
  setActiveNotice: (noticeId: string) => void;
  setNoticeActiveVersion: (noticeId: string, versionNumber: number) => void;
  toggleRequirementCheck: (
    noticeId: string,
    requirement: Requirement,
    versionNumber: number
  ) => void;
  reverifyRequirement: (
    noticeId: string,
    requirement: Requirement,
    versionNumber: number
  ) => void;
  updateProfile: (partial: Partial<ApplicantProfile>) => void;
  submitCommunityReport: (
    report: Omit<
      CommunityReport,
      "id" | "submittedAt" | "verificationStatus" | "corroborationCount"
    >
  ) => void;
  loadScenarioV1Ready: () => void;
  simulateV2UpdateArrival: () => void;
  resetDemoData: () => void;
}

export const useNiyomStore = create<NiyomStoreState>((set, get) => ({
  notices: SEED_NOTICES,
  activeNoticeId: "notice-merit-2026",
  profile: DEFAULT_APPLICANT_PROFILE,
  readinessRecords: [],
  communityReports: SEED_COMMUNITY_REPORTS,
  demoScenarioStage: "custom",
  isHydrated: false,

  hydrateFromStorage: async () => {
    try {
      const persisted = await loadPersistedState();
      set((state) => {
        const updatedNotices = state.notices.map((n) => {
          if (persisted.activeVersions[n.id]) {
            return {
              ...n,
              activeVersionNumber: persisted.activeVersions[n.id],
            };
          }
          return n;
        });

        // Merge community reports with seeds to avoid losing default corroborated evidence
        const existingIds = new Set(persisted.communityReports.map((r) => r.id));
        const combinedReports = [
          ...persisted.communityReports,
          ...SEED_COMMUNITY_REPORTS.filter((r) => !existingIds.has(r.id)),
        ];

        return {
          profile: persisted.profile || state.profile,
          readinessRecords:
            persisted.readinessRecords.length > 0
              ? persisted.readinessRecords
              : state.readinessRecords,
          communityReports: combinedReports,
          notices: updatedNotices,
          isHydrated: true,
        };
      });
    } catch (err) {
      console.warn("Storage hydration bypassed:", err);
      set({ isHydrated: true });
    }
  },

  setActiveNotice: (noticeId: string) => {
    set({ activeNoticeId: noticeId });
  },

  setNoticeActiveVersion: (noticeId: string, versionNumber: number) => {
    set((state) => ({
      notices: state.notices.map((n) =>
        n.id === noticeId ? { ...n, activeVersionNumber: versionNumber } : n
      ),
      demoScenarioStage: "custom",
    }));
    void persistActiveVersion(noticeId, versionNumber);
  },

  toggleRequirementCheck: (
    noticeId: string,
    requirement: Requirement,
    versionNumber: number
  ) => {
    const state = get();
    const existingIndex = state.readinessRecords.findIndex(
      (r) => r.noticeId === noticeId && r.requirementId === requirement.id
    );

    let updatedRecord: ReadinessRecord;
    let nextRecords: ReadinessRecord[];

    if (existingIndex >= 0) {
      const existing = state.readinessRecords[existingIndex];
      updatedRecord = {
        ...existing,
        checked: !existing.checked,
        verifiedAgainstValue: requirement.value,
        verifiedAgainstVersion: versionNumber,
        updatedAt: new Date().toISOString(),
      };
      nextRecords = [...state.readinessRecords];
      nextRecords[existingIndex] = updatedRecord;
    } else {
      updatedRecord = {
        noticeId,
        requirementId: requirement.id,
        checked: true,
        verifiedAgainstValue: requirement.value,
        verifiedAgainstVersion: versionNumber,
        updatedAt: new Date().toISOString(),
      };
      nextRecords = [...state.readinessRecords, updatedRecord];
    }

    set({ readinessRecords: nextRecords, demoScenarioStage: "custom" });
    void persistReadinessRecord(updatedRecord);
  },

  reverifyRequirement: (
    noticeId: string,
    requirement: Requirement,
    versionNumber: number
  ) => {
    const state = get();
    const existingIndex = state.readinessRecords.findIndex(
      (r) => r.noticeId === noticeId && r.requirementId === requirement.id
    );

    const updatedRecord: ReadinessRecord = {
      noticeId,
      requirementId: requirement.id,
      checked: true,
      verifiedAgainstValue: requirement.value,
      verifiedAgainstVersion: versionNumber,
      updatedAt: new Date().toISOString(),
    };

    let nextRecords: ReadinessRecord[];
    if (existingIndex >= 0) {
      nextRecords = [...state.readinessRecords];
      nextRecords[existingIndex] = updatedRecord;
    } else {
      nextRecords = [...state.readinessRecords, updatedRecord];
    }

    set({ readinessRecords: nextRecords, demoScenarioStage: "custom" });
    void persistReadinessRecord(updatedRecord);
  },

  updateProfile: (partial: Partial<ApplicantProfile>) => {
    const updated = { ...get().profile, ...partial };
    set({ profile: updated });
    void persistProfile(updated);
  },

  submitCommunityReport: (
    reportInput: Omit<
      CommunityReport,
      "id" | "submittedAt" | "verificationStatus" | "corroborationCount"
    >
  ) => {
    const newReport: CommunityReport = {
      ...reportInput,
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submittedAt: new Date().toISOString(),
      verificationStatus: "pending_verification",
      corroborationCount: 1,
    };

    const nextReports = [newReport, ...get().communityReports];
    set({ communityReports: nextReports });
    void persistCommunityReport(newReport);
  },

  loadScenarioV1Ready: () => {
    const state = get();
    const notice = state.notices.find((n) => n.id === "notice-merit-2026") || SEED_NOTICES[0];
    const v1 = notice.versions.find((v) => v.versionNumber === 1) || notice.versions[0];

    // Seed readiness records marking all applicable mandatory v1 requirements checked against v1 values
    const recordsToSet: ReadinessRecord[] = v1.requirements
      .filter((r) => r.mandatory)
      .map((r) => ({
        noticeId: notice.id,
        requirementId: r.id,
        checked: true,
        verifiedAgainstValue: r.value,
        verifiedAgainstVersion: 1,
        updatedAt: new Date().toISOString(),
      }));

    // Retain records for any other notices
    const otherRecords = state.readinessRecords.filter(
      (r) => r.noticeId !== "notice-merit-2026"
    );
    const combinedRecords = [...otherRecords, ...recordsToSet];

    set({
      notices: state.notices.map((n) =>
        n.id === "notice-merit-2026" ? { ...n, activeVersionNumber: 1 } : n
      ),
      readinessRecords: combinedRecords,
      demoScenarioStage: "v1_ready",
    });

    void persistAllReadinessRecords(combinedRecords);
    void persistActiveVersion("notice-merit-2026", 1);
  },

  simulateV2UpdateArrival: () => {
    const state = get();
    const notice = state.notices.find((n) => n.id === "notice-merit-2026") || SEED_NOTICES[0];
    const v1 = notice.versions.find((v) => v.versionNumber === 1) || notice.versions[0];

    // Ensure v1 records were verified against v1 values
    const v1RecordsMap = new Map<string, ReadinessRecord>();
    state.readinessRecords
      .filter((r) => r.noticeId === "notice-merit-2026")
      .forEach((r) => v1RecordsMap.set(r.requirementId, r));

    const baselineRecords: ReadinessRecord[] = v1.requirements
      .filter((r) => r.mandatory)
      .map((r) => {
        const existing = v1RecordsMap.get(r.id);
        if (existing && existing.checked) {
          return existing;
        }
        return {
          noticeId: notice.id,
          requirementId: r.id,
          checked: true,
          verifiedAgainstValue: r.value,
          verifiedAgainstVersion: 1,
          updatedAt: new Date().toISOString(),
        };
      });

    const otherRecords = state.readinessRecords.filter(
      (r) => r.noticeId !== "notice-merit-2026"
    );
    const combinedRecords = [...otherRecords, ...baselineRecords];

    set({
      notices: state.notices.map((n) =>
        n.id === "notice-merit-2026" ? { ...n, activeVersionNumber: 3 } : n
      ),
      readinessRecords: combinedRecords,
      demoScenarioStage: "v2_updated",
    });

    void persistAllReadinessRecords(combinedRecords);
    void persistActiveVersion("notice-merit-2026", 3);
  },

  resetDemoData: () => {
    set({
      notices: SEED_NOTICES,
      activeNoticeId: "notice-merit-2026",
      profile: DEFAULT_APPLICANT_PROFILE,
      readinessRecords: [],
      communityReports: SEED_COMMUNITY_REPORTS,
      demoScenarioStage: "custom",
    });
    void clearPersistedData();
  },
}));

