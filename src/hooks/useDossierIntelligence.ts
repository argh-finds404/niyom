"use client";

import { useMemo } from "react";
import { useNiyomStore } from "./useNiyomStore";
import {
  calculateNoticeReadiness,
  compareNoticeVersions,
  computePreparationTimeline,
  computeSharedFolderGroups,
  type PreparationTimeline,
  type SharedFolderGroup,
} from "@/domain";
import type { Notice, NoticeVersion, ReadinessSummary, RequirementChange } from "@/domain/types";

export interface DossierIntelligence {
  notice: Notice;
  activeVersion: NoticeVersion;
  previousVersion: NoticeVersion | null;
  baselineVersion: NoticeVersion;
  readinessSummary: ReadinessSummary;
  /** Baseline (first version) → active version. Empty when the baseline is active. */
  versionChanges: RequirementChange[];
  /** Counter-day lead-time, latest safe start date, and 3-stage preparation sequence. */
  timeline: PreparationTimeline;
}

export function versionOf(notice: Notice, versionNumber: number): NoticeVersion {
  return notice.versions.find((v) => v.versionNumber === versionNumber) ?? notice.versions[0];
}

/** Pure: everything a screen needs about one dossier, derived from store state. */
export function deriveIntelligence(
  notice: Notice,
  state: Pick<ReturnType<typeof useNiyomStore.getState>, "profile" | "readinessRecords" | "communityReports">
): DossierIntelligence {
  const activeVersion = versionOf(notice, notice.activeVersionNumber);
  const idx = notice.versions.indexOf(activeVersion);
  const baselineVersion = notice.versions[0];
  const readinessSummary = calculateNoticeReadiness(
    notice,
    state.profile,
    state.readinessRecords,
    state.communityReports
  );
  return {
    notice,
    activeVersion,
    previousVersion: idx > 0 ? notice.versions[idx - 1] : null,
    baselineVersion,
    readinessSummary,
    versionChanges: idx > 0 ? compareNoticeVersions(baselineVersion, activeVersion) : [],
    timeline: computePreparationTimeline(notice, readinessSummary),
  };
}

/** Intelligence for one dossier (defaults to the active dossier). */
export function useDossierIntelligence(noticeId?: string): DossierIntelligence | null {
  const notices = useNiyomStore((s) => s.notices);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const profile = useNiyomStore((s) => s.profile);
  const readinessRecords = useNiyomStore((s) => s.readinessRecords);
  const communityReports = useNiyomStore((s) => s.communityReports);
  const id = noticeId ?? activeNoticeId;

  return useMemo(() => {
    const notice = notices.find((n) => n.id === id);
    return notice ? deriveIntelligence(notice, { profile, readinessRecords, communityReports }) : null;
  }, [notices, id, profile, readinessRecords, communityReports]);
}

/** Intelligence for every dossier, in seed order. */
export function useAllIntelligence(): DossierIntelligence[] {
  const notices = useNiyomStore((s) => s.notices);
  const profile = useNiyomStore((s) => s.profile);
  const readinessRecords = useNiyomStore((s) => s.readinessRecords);
  const communityReports = useNiyomStore((s) => s.communityReports);

  return useMemo(
    () => notices.map((n) => deriveIntelligence(n, { profile, readinessRecords, communityReports })),
    [notices, profile, readinessRecords, communityReports]
  );
}

/** Shared physical folder equivalence groups across all 4 dossiers. */
export function useSharedFolderGroups(): SharedFolderGroup[] {
  const notices = useNiyomStore((s) => s.notices);
  const profile = useNiyomStore((s) => s.profile);
  const readinessRecords = useNiyomStore((s) => s.readinessRecords);

  return useMemo(
    () => computeSharedFolderGroups(notices, profile, readinessRecords),
    [notices, profile, readinessRecords]
  );
}
