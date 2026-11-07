"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WatchState {
  /** The last version you reviewed, per dossier. Missing = the version it was first shown at. */
  lastSeen: Record<string, number>;
  /** Dossiers you chose not to follow. Everything else is followed. */
  unfollowed: string[];
  markSeen: (noticeId: string, versionNumber: number) => void;
  toggleFollow: (noticeId: string) => void;
  resetWatch: () => void;
}

/**
 * Follow & alert state. Persisted in localStorage; hydration is manual (AppShell calls
 * rehydrate on mount) so the server HTML and the first client render agree.
 */
export const useWatchStore = create<WatchState>()(
  persist(
    (set, get) => ({
      lastSeen: {},
      unfollowed: [],
      markSeen: (noticeId, versionNumber) => set({ lastSeen: { ...get().lastSeen, [noticeId]: versionNumber } }),
      toggleFollow: (noticeId) => {
        const u = get().unfollowed;
        set({ unfollowed: u.includes(noticeId) ? u.filter((x) => x !== noticeId) : [...u, noticeId] });
      },
      resetWatch: () => set({ lastSeen: {}, unfollowed: [] }),
    }),
    {
      name: "niyom-watch",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
