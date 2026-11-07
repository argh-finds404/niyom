import { create } from "zustand";
import { ApplicantProfile, CommunityReport, Notice, ReadinessRecord, Requirement } from "../domain/types";
import { applicantProfileSchema } from "../domain/schemas";
import { DEFAULT_APPLICANT_PROFILE, SEED_COMMUNITY_REPORTS, SEED_NOTICES } from "../data/seed/notices.seed";
import {
  clearPersistedData,
  deleteCommunityReport,
  loadPersistedState,
  persistActiveVersion,
  persistAllReadinessRecords,
  persistCommunityReport,
  persistProfile,
  persistReadinessRecord,
} from "../data/persistence/db";
import { mergeRecords } from "../lib/records";

type Stage = "v1_ready" | "v2_updated" | "custom";

/** A report as the API returns it: the public record plus flags relative to this device. */
type ServerReport = CommunityReport & { yours?: boolean; confirmedByYou?: boolean };

export type SubmittedReportPayload = Omit<CommunityReport, "id" | "submittedAt" | "verificationStatus" | "corroborationCount"> &
  Partial<Pick<CommunityReport, "id" | "submittedAt" | "verificationStatus" | "corroborationCount">>;

export type CorroborateOutcome = "ok" | "duplicate" | "own" | "offline" | "error";

interface StatePatch {
  profile?: ApplicantProfile;
  readinessRecords?: ReadinessRecord[];
  activeVersions?: Record<string, number>;
  demoScenarioStage?: Stage;
}

export interface NiyomStoreState {
  notices: Notice[];
  activeNoticeId: string;
  profile: ApplicantProfile;
  readinessRecords: ReadinessRecord[];
  communityReports: CommunityReport[];
  /** Reports this device filed, and reports it has confirmed (from the server). */
  myReportIds: string[];
  myConfirmedIds: string[];
  demoScenarioStage: Stage;
  isHydrated: boolean;
  backendStatus: "connecting" | "online" | "offline";
  lastSyncedAt: string | null;

  hydrateFromStorage: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  setActiveNotice: (noticeId: string) => void;
  setNoticeActiveVersion: (noticeId: string, versionNumber: number) => void;
  toggleRequirementCheck: (noticeId: string, requirement: Requirement, versionNumber: number) => void;
  reverifyRequirement: (noticeId: string, requirement: Requirement, versionNumber: number) => void;
  updateProfile: (partial: Partial<ApplicantProfile>) => void;
  /** Keeps the report on this device; uploads it unless `upload` is false (the caller already tried). */
  submitCommunityReport: (report: SubmittedReportPayload | ServerReport, options?: { upload?: boolean }) => void;
  corroborateReport: (reportId: string) => Promise<CorroborateOutcome>;
  loadScenarioV1Ready: () => void;
  simulateV2UpdateArrival: () => void;
  resetDemoData: () => void;
}

const HERO = "notice-merit-2026";
const isBrowser = () => typeof window !== "undefined" && typeof fetch !== "undefined";
const now = () => new Date().toISOString();
const stripFlags = ({ yours: _y, confirmedByYou: _c, ...r }: ServerReport): CommunityReport => r;

/* What was found in IndexedDB at start-up: local data wins over the server only where it exists. */
let localProfileFound = false;
let localVersions: Record<string, number> = {};

/* ───────────── Ordered sync queue ─────────────
 * Changes are coalesced into one pending patch and sent one request at a time, so this tab's
 * requests can never arrive out of order. When the network or server fails (or rate-limits),
 * the patch is kept and the whole sync runs again with backoff, on reconnect, or on the next change. */
let pending: StatePatch | null = null;
let flushing = false;
let syncing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
/* Reports filed offline (id "local-…") that are being uploaded, or that the server refused for good. */
const uploading = new Set<string>();
const refused = new Set<string>();
const isLocalReport = (id: string) => id.startsWith("local-");

function mergePatch(a: StatePatch | null, b: StatePatch): StatePatch {
  return {
    ...a,
    ...b,
    activeVersions: a?.activeVersions || b.activeVersions ? { ...a?.activeVersions, ...b.activeVersions } : undefined,
    readinessRecords:
      a?.readinessRecords || b.readinessRecords ? mergeRecords(a?.readinessRecords ?? [], b.readinessRecords ?? []) : undefined,
  };
}

export const useNiyomStore = create<NiyomStoreState>((set, get) => {
  const markSynced = (ok: boolean) =>
    set({ backendStatus: ok ? "online" : "offline", lastSyncedAt: ok ? now() : get().lastSyncedAt });

  /** Runs the full sync again later: after Retry-After when given, otherwise 2s, 4s, 8s… up to a minute. */
  function retryLater(retryAfterSeconds?: number) {
    if (!isBrowser() || retryTimer) return;
    const ms = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : Math.min(60_000, 2_000 * 2 ** failures);
    failures += 1;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void get().syncWithBackend();
    }, ms);
  }

  const retryAfter = (res: Response) => Number(res.headers.get("Retry-After")) || undefined;

  async function flush() {
    if (flushing || !pending || !isBrowser()) return;
    flushing = true;
    while (pending) {
      const body = pending;
      pending = null;
      try {
        const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (res.ok) {
          failures = 0;
          markSynced(true);
          continue;
        }
        if (res.status === 429 || res.status >= 500) {
          // Temporary: keep the patch (newer changes merged on top) and try again later.
          pending = mergePatch(body, pending ?? {});
          markSynced(res.status === 429);
          retryLater(retryAfter(res));
          break;
        }
        // Any other 4xx means the server will never accept this patch; dropping it avoids an endless loop.
        markSynced(true);
        console.warn(`[niyom] The server refused a change (${res.status}); it is kept on this device only.`);
      } catch {
        pending = mergePatch(body, pending ?? {});
        markSynced(false);
        retryLater();
        break;
      }
    }
    flushing = false;
  }

  function push(patch: StatePatch) {
    pending = mergePatch(pending, patch);
    void flush();
  }

  /** Sends a report filed on this device (offline) and swaps in the server's stamped record. */
  async function uploadReport(report: CommunityReport) {
    if (!isBrowser() || uploading.has(report.id) || refused.has(report.id)) return;
    uploading.add(report.id);
    const { noticeId, requirementId, reportType, observation, evidenceUrlOrRef } = report;
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId, requirementId, reportType, observation, evidenceUrlOrRef }),
      });
      if (res.ok) {
        markSynced(true);
        const stamped = stripFlags((await res.json()) as ServerReport);
        set({
          communityReports: [stamped, ...get().communityReports.filter((r) => r.id !== report.id)],
          myReportIds: [...get().myReportIds.filter((id) => id !== report.id), stamped.id],
        });
        void persistCommunityReport(stamped);
        void deleteCommunityReport(report.id);
      } else if (res.status === 429 || res.status >= 500) {
        markSynced(res.status === 429);
        retryLater(retryAfter(res));
      } else {
        refused.add(report.id); // invalid for the server: it stays on this device, and is not sent again
      }
    } catch {
      markSynced(false);
      retryLater();
    } finally {
      uploading.delete(report.id);
    }
  }

  if (isBrowser()) {
    window.addEventListener("online", () => void get().syncWithBackend());
    // Coming back to the tab picks up what others confirmed meanwhile.
    document.addEventListener("visibilitychange", () => {
      const last = get().lastSyncedAt;
      if (document.visibilityState === "visible" && get().isHydrated && (!last || Date.now() - Date.parse(last) > 15_000)) {
        void get().syncWithBackend();
      }
    });
  }

  function applyReports(reports: ServerReport[]) {
    const known = new Map(SEED_COMMUNITY_REPORTS.map((r) => [r.id, r] as const));
    // Keep reports filed here while offline (not yet on the server).
    for (const r of get().communityReports) known.set(r.id, r);
    for (const r of reports) known.set(r.id, stripFlags(r));
    const all = [...known.values()];
    set({
      communityReports: all.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
      // Reports still only on this device are this device's too.
      myReportIds: [...reports.filter((r) => r.yours).map((r) => r.id), ...all.filter((r) => isLocalReport(r.id)).map((r) => r.id)],
      myConfirmedIds: reports.filter((r) => r.confirmedByYou).map((r) => r.id),
    });
  }

  async function runSync() {
    try {
      const res = await fetch("/api/state", { method: "GET" });
      if (!res.ok) {
        markSynced(res.status === 429);
        retryLater(retryAfter(res));
        return;
      }
      const server = (await res.json()) as {
        profile: ApplicantProfile;
        readinessRecords: ReadinessRecord[];
        activeVersions: Record<string, number>;
        demoScenarioStage: Stage;
        communityReports: ServerReport[];
      };
      const local = get();
      const records = mergeRecords(server.readinessRecords ?? [], local.readinessRecords);
      const profile = localProfileFound ? local.profile : (server.profile ?? local.profile);
      const versions = { ...(server.activeVersions ?? {}), ...localVersions };

      set({
        profile,
        readinessRecords: records,
        notices: local.notices.map((n) => (versions[n.id] ? { ...n, activeVersionNumber: versions[n.id] } : n)),
        demoScenarioStage: local.demoScenarioStage !== "custom" ? local.demoScenarioStage : (server.demoScenarioStage ?? "custom"),
      });
      applyReports(server.communityReports ?? []);
      void persistAllReadinessRecords(records);
      if (!localProfileFound) void persistProfile(profile);

      // Send up whatever only this browser knew.
      const serverKeys = new Map((server.readinessRecords ?? []).map((r) => [`${r.noticeId}::${r.requirementId}`, r.updatedAt]));
      const newer = records.filter((r) => {
        const at = serverKeys.get(`${r.noticeId}::${r.requirementId}`);
        return !at || Date.parse(r.updatedAt) > Date.parse(at);
      });
      const patch: StatePatch = {};
      if (newer.length) patch.readinessRecords = newer;
      const profileKeys = Object.keys(profile) as (keyof ApplicantProfile)[];
      if (localProfileFound && !profileKeys.every((k) => server.profile?.[k] === profile[k])) patch.profile = profile;
      const versionsAhead = Object.fromEntries(Object.entries(localVersions).filter(([id, v]) => server.activeVersions?.[id] !== v));
      if (Object.keys(versionsAhead).length) patch.activeVersions = versionsAhead;
      failures = 0;
      markSynced(true);
      if (Object.keys(patch).length) push(patch);
      void flush();
      // Reports filed while offline go up now.
      for (const r of get().communityReports) if (isLocalReport(r.id)) void uploadReport(r);
    } catch {
      markSynced(false);
      retryLater();
    }
  }

  return {
    notices: SEED_NOTICES,
    activeNoticeId: HERO,
    profile: DEFAULT_APPLICANT_PROFILE,
    readinessRecords: [],
    communityReports: SEED_COMMUNITY_REPORTS,
    myReportIds: [],
    myConfirmedIds: [],
    demoScenarioStage: "custom",
    isHydrated: false,
    backendStatus: "connecting",
    lastSyncedAt: null,

    hydrateFromStorage: async () => {
      try {
        const persisted = await loadPersistedState();
        localProfileFound = persisted.profile !== null;
        localVersions = persisted.activeVersions;
        set((state) => {
          const known = new Set(persisted.communityReports.map((r) => r.id));
          return {
            profile: persisted.profile ?? state.profile,
            readinessRecords: persisted.readinessRecords.length ? persisted.readinessRecords : state.readinessRecords,
            communityReports: [...persisted.communityReports, ...SEED_COMMUNITY_REPORTS.filter((r) => !known.has(r.id))],
            notices: state.notices.map((n) => (persisted.activeVersions[n.id] ? { ...n, activeVersionNumber: persisted.activeVersions[n.id] } : n)),
            isHydrated: true,
          };
        });
      } catch (err) {
        console.warn("Storage hydration bypassed:", err);
        set({ isHydrated: true });
      }
      await get().syncWithBackend();
    },

    /**
     * Reconciles this device with its own server state (the server scopes it by a device cookie).
     * Checks merge record by record; local profile and versions win where they exist locally.
     */
    syncWithBackend: () => {
      if (!isBrowser()) return Promise.resolve();
      // One sync at a time: focus, reconnect and retries can all ask at once.
      syncing ??= runSync().finally(() => {
        syncing = null;
      });
      return syncing;
    },

    setActiveNotice: (noticeId) => set({ activeNoticeId: noticeId }),

    setNoticeActiveVersion: (noticeId, versionNumber) => {
      set((state) => ({
        notices: state.notices.map((n) => (n.id === noticeId ? { ...n, activeVersionNumber: versionNumber } : n)),
        demoScenarioStage: "custom",
      }));
      localVersions = { ...localVersions, [noticeId]: versionNumber };
      void persistActiveVersion(noticeId, versionNumber);
      push({ activeVersions: { [noticeId]: versionNumber }, demoScenarioStage: "custom" });
    },

    toggleRequirementCheck: (noticeId, requirement, versionNumber) => {
      const existing = get().readinessRecords.find((r) => r.noticeId === noticeId && r.requirementId === requirement.id);
      const record: ReadinessRecord = {
        noticeId,
        requirementId: requirement.id,
        checked: existing ? !existing.checked : true,
        verifiedAgainstValue: requirement.value,
        verifiedAgainstVersion: versionNumber,
        updatedAt: now(),
      };
      set({ readinessRecords: mergeRecords(get().readinessRecords, [record]), demoScenarioStage: "custom" });
      void persistReadinessRecord(record);
      push({ readinessRecords: [record], demoScenarioStage: "custom" });
    },

    reverifyRequirement: (noticeId, requirement, versionNumber) => {
      const record: ReadinessRecord = {
        noticeId,
        requirementId: requirement.id,
        checked: true,
        verifiedAgainstValue: requirement.value,
        verifiedAgainstVersion: versionNumber,
        updatedAt: now(),
      };
      set({ readinessRecords: mergeRecords(get().readinessRecords, [record]), demoScenarioStage: "custom" });
      void persistReadinessRecord(record);
      push({ readinessRecords: [record], demoScenarioStage: "custom" });
    },

    updateProfile: (partial) => {
      const parsed = applicantProfileSchema.safeParse({ ...get().profile, ...partial });
      // The UI validates fields before calling this; an invalid profile is never stored or sent.
      if (!parsed.success) return;
      localProfileFound = true;
      set({ profile: parsed.data });
      void persistProfile(parsed.data);
      push({ profile: parsed.data });
    },

    submitCommunityReport: (input, options) => {
      const report: CommunityReport = {
        noticeId: input.noticeId,
        requirementId: input.requirementId,
        reportType: input.reportType,
        observation: input.observation,
        evidenceUrlOrRef: input.evidenceUrlOrRef,
        id: input.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        submittedAt: input.submittedAt ?? now(),
        verificationStatus: input.verificationStatus ?? "pending_verification",
        corroborationCount: input.corroborationCount ?? 1,
      };
      set({
        communityReports: [report, ...get().communityReports.filter((r) => r.id !== report.id)],
        myReportIds: [...get().myReportIds, report.id],
      });
      void persistCommunityReport(report);

      // Filed without the server: upload it now, or (when the caller just failed to) on the next sync.
      if (input.id || !isBrowser()) return;
      if (options?.upload === false) retryLater();
      else void uploadReport(report);
    },

    corroborateReport: async (reportId) => {
      const s = get();
      if (s.myReportIds.includes(reportId)) return "own";
      if (s.myConfirmedIds.includes(reportId)) return "duplicate";
      const before = s.communityReports.find((r) => r.id === reportId);
      if (!before) return "error";

      const replace = (r: CommunityReport) => set({ communityReports: get().communityReports.map((x) => (x.id === r.id ? r : x)) });
      // Optimistic: show the confirmation at once, reconcile with the server's count.
      replace({ ...before, corroborationCount: before.corroborationCount + 1 });
      set({ myConfirmedIds: [...get().myConfirmedIds, reportId] });
      const undo = () => {
        replace(before);
        set({ myConfirmedIds: get().myConfirmedIds.filter((id) => id !== reportId) });
      };

      if (!isBrowser()) return "ok";
      try {
        const res = await fetch("/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: reportId }) });
        const body = (await res.json().catch(() => ({}))) as ServerReport & { report?: ServerReport };
        markSynced(res.status < 500);
        if (res.ok) {
          replace(stripFlags(body));
          void persistCommunityReport(stripFlags(body));
          return "ok";
        }
        if (res.status === 409) {
          if (body.report) replace(stripFlags(body.report));
          return "duplicate";
        }
        undo();
        if (res.status === 403) {
          set({ myReportIds: [...get().myReportIds, reportId] });
          return "own";
        }
        return "error";
      } catch {
        undo();
        markSynced(false);
        return "offline";
      }
    },

    loadScenarioV1Ready: () => {
      const state = get();
      const notice = state.notices.find((n) => n.id === HERO) ?? SEED_NOTICES[0];
      const v1 = notice.versions.find((v) => v.versionNumber === 1) ?? notice.versions[0];
      const at = now();
      const checked = v1.requirements
        .filter((r) => r.mandatory)
        .map((r) => ({ noticeId: notice.id, requirementId: r.id, checked: true, verifiedAgainstValue: r.value, verifiedAgainstVersion: 1, updatedAt: at }));
      // Other Merit Grant checks are cleared explicitly so the server forgets them too.
      const ids = new Set(checked.map((r) => r.requirementId));
      const cleared = state.readinessRecords
        .filter((r) => r.noticeId === HERO && !ids.has(r.requirementId) && r.checked)
        .map((r) => ({ ...r, checked: false, updatedAt: at }));
      const changes = [...checked, ...cleared];
      const records = mergeRecords(state.readinessRecords, changes);

      set({
        notices: state.notices.map((n) => (n.id === HERO ? { ...n, activeVersionNumber: 1 } : n)),
        readinessRecords: records,
        demoScenarioStage: "v1_ready",
      });
      localVersions = { ...localVersions, [HERO]: 1 };
      void persistAllReadinessRecords(records);
      void persistActiveVersion(HERO, 1);
      push({ readinessRecords: changes, activeVersions: { [HERO]: 1 }, demoScenarioStage: "v1_ready" });
    },

    simulateV2UpdateArrival: () => {
      const state = get();
      const notice = state.notices.find((n) => n.id === HERO) ?? SEED_NOTICES[0];
      const v1 = notice.versions.find((v) => v.versionNumber === 1) ?? notice.versions[0];
      const mine = new Map(state.readinessRecords.filter((r) => r.noticeId === HERO).map((r) => [r.requirementId, r]));
      const at = now();
      // You had prepared every v1.0 item; keep what you already checked, fill in the rest against v1.0.
      const baseline = v1.requirements
        .filter((r) => r.mandatory)
        .map((r) => {
          const existing = mine.get(r.id);
          return existing?.checked
            ? existing
            : { noticeId: notice.id, requirementId: r.id, checked: true, verifiedAgainstValue: r.value, verifiedAgainstVersion: 1, updatedAt: at };
        });
      const records = mergeRecords(state.readinessRecords, baseline);

      set({
        notices: state.notices.map((n) => (n.id === HERO ? { ...n, activeVersionNumber: 3 } : n)),
        readinessRecords: records,
        demoScenarioStage: "v2_updated",
      });
      localVersions = { ...localVersions, [HERO]: 3 };
      void persistAllReadinessRecords(records);
      void persistActiveVersion(HERO, 3);
      push({ readinessRecords: baseline, activeVersions: { [HERO]: 3 }, demoScenarioStage: "v2_updated" });
    },

    resetDemoData: () => {
      pending = null;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      failures = 0;
      localProfileFound = false;
      localVersions = {};
      set({
        notices: SEED_NOTICES,
        activeNoticeId: HERO,
        profile: DEFAULT_APPLICANT_PROFILE,
        readinessRecords: [],
        communityReports: SEED_COMMUNITY_REPORTS,
        myReportIds: [],
        myConfirmedIds: [],
        demoScenarioStage: "custom",
      });
      void clearPersistedData();
      if (!isBrowser()) return;
      // Clears this device's state on the server only, then pulls the public reports back in.
      void fetch("/api/state", { method: "DELETE" })
        .then((r) => {
          markSynced(r.ok);
          return get().syncWithBackend();
        })
        .catch(() => set({ backendStatus: "offline" }));
    },
  };
});
