"use client";

import { useRouter } from "next/navigation";
import { calculateNoticeReadiness } from "@/domain/readiness/calculate";
import { shortTitle, versionTag } from "@/lib/format";
import { useNiyomStore } from "./useNiyomStore";
import { useUiStore } from "./useUiStore";
import { useWatchStore } from "./useWatchStore";

export const HERO_NOTICE_ID = "notice-merit-2026";
export const RAILWAY_NOTICE_ID = "service-railway-refund";

/** The walkthrough steps, shared by the demo menu, the hero and the command palette. */
export function useScenarios() {
  const router = useRouter();
  const store = useNiyomStore;
  const ui = useUiStore;

  return {
    /** Every required paper of a dossier checked against its original notice. */
    baseline(noticeId: string = HERO_NOTICE_ID) {
      const notice = store.getState().notices.find((n) => n.id === noticeId);
      if (!notice) return;
      store.getState().setActiveNotice(noticeId);
      store.getState().prepareForOriginal(noticeId);
      // You prepared against the original and reviewed it, so only a newer version will alert you.
      useWatchStore.getState().markSeen(noticeId, notice.versions[0].versionNumber);
      ui.getState().toast({
        tone: "ok",
        title: "You're prepared for the original",
        body: `Every required ${shortTitle(notice)} paper is checked against the original notice.`,
      });
    },
    /** A prepared applicant receives an update (default: the latest) and sees what it invalidates. */
    simulateCorrigendum(noticeId: string = HERO_NOTICE_ID, versionNumber?: number) {
      const notice = store.getState().notices.find((n) => n.id === noticeId);
      if (!notice) return;
      const original = notice.versions[0].versionNumber;
      store.getState().setActiveNotice(noticeId);
      // An update is only news if you had reviewed an earlier version.
      const seen = useWatchStore.getState().lastSeen[noticeId];
      if (seen === undefined || seen > original) useWatchStore.getState().markSeen(noticeId, original);
      store.getState().receiveUpdate(noticeId, versionNumber);
      const s = store.getState();
      const updated = s.notices.find((n) => n.id === noticeId)!;
      const version = updated.versions.find((v) => v.versionNumber === updated.activeVersionNumber)!;
      const summary = calculateNoticeReadiness(updated, s.profile, s.readinessRecords, s.communityReports);
      const stale = summary.staleReverificationCount;
      // Every paper of the original was prepared, so what is still pending is what the update added.
      const added = summary.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES" && i.readinessStatus === "pending").length;
      const effects = [
        stale && (stale === 1 ? "one of your checks needs another look" : `${stale} of your checks need another look`),
        added && (added === 1 ? "one new paper is now required" : `${added} new papers are now required`),
      ].filter(Boolean);
      ui.getState().toast({
        tone: effects.length ? "warn" : "neutral",
        title: `${shortTitle(updated)} was revised`,
        body: effects.length
          ? `${versionTag(version)} changes what you must submit: ${effects.join(" and ")}.`
          : `${versionTag(version)} is out. None of the papers you prepared are affected.`,
      });
    },
    openRailway() {
      store.getState().setActiveNotice(RAILWAY_NOTICE_ID);
      router.push(`/notice/${RAILWAY_NOTICE_ID}`);
    },
    reset() {
      store.getState().resetDemoData();
      useWatchStore.getState().resetWatch();
      ui.getState().toast({
        tone: "neutral",
        title: "Demo reset",
        body: "Checks, profile and field reports are back to the starting dataset.",
      });
    },
  };
}
