"use client";

import { useRouter } from "next/navigation";
import { calculateNoticeReadiness } from "@/domain/readiness/calculate";
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
    baseline() {
      store.getState().setActiveNotice(HERO_NOTICE_ID);
      store.getState().loadScenarioV1Ready();
      // You prepared against v1.0 and reviewed it, so only a newer version will alert you.
      useWatchStore.getState().markSeen(HERO_NOTICE_ID, 1);
      ui.getState().toast({
        tone: "ok",
        title: "You're prepared for v1.0",
        body: "Every required Merit Grant item is checked against the original circular.",
      });
    },
    simulateCorrigendum() {
      store.getState().setActiveNotice(HERO_NOTICE_ID);
      // A corrigendum arriving is only news if you had reviewed an earlier version.
      const seen = useWatchStore.getState().lastSeen[HERO_NOTICE_ID];
      if (seen === undefined || seen >= 3) useWatchStore.getState().markSeen(HERO_NOTICE_ID, 1);
      store.getState().simulateV2UpdateArrival();
      const s = store.getState();
      const notice = s.notices.find((n) => n.id === HERO_NOTICE_ID)!;
      const stale = calculateNoticeReadiness(notice, s.profile, s.readinessRecords, s.communityReports).staleReverificationCount;
      ui.getState().toast({
        tone: "warn",
        title: "Merit Grant 2026 was revised",
        body: stale
          ? `Version 2.0 changes what you must submit. ${stale === 1 ? "One of your checks needs" : `${stale} of your checks need`} another look.`
          : "Version 2.0 is out. None of your checks are affected.",
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
