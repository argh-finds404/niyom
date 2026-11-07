"use client";

import { create } from "zustand";

export type ToastTone = "neutral" | "ok" | "warn" | "crit";
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  leaving?: boolean;
}

interface DrawerContext {
  noticeId?: string;
  requirementId?: string;
}

/** What the inspector shows. Ids only, resolved at render so it never goes stale. */
export interface InspectorTarget {
  noticeId: string;
  requirementId: string;
}

interface UiState {
  inspector: InspectorTarget | null;
  apiOpen: boolean;
  openInspector: (t: InspectorTarget) => void;
  closeInspector: () => void;
  setApiOpen: (open: boolean) => void;
  paletteOpen: boolean;
  helpOpen: boolean;
  drawer: DrawerContext | null;
  mobileNavOpen: boolean;
  toasts: Toast[];
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  openDrawer: (ctx?: DrawerContext) => void;
  closeDrawer: () => void;
  setMobileNavOpen: (open: boolean) => void;
  toast: (t: Omit<Toast, "id" | "leaving">) => void;
  /** Plays the exit animation, then removes the toast. */
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

const CLOSED_OVERLAYS = {
  inspector: null,
  drawer: null,
  paletteOpen: false,
  helpOpen: false,
  apiOpen: false,
  mobileNavOpen: false,
} as const;

/** Ephemeral UI state only. Domain state lives in useNiyomStore. */
export const useUiStore = create<UiState>((set, get) => ({
  ...CLOSED_OVERLAYS,
  toasts: [],
  openInspector: (inspector) => set({ ...CLOSED_OVERLAYS, inspector }),
  closeInspector: () => set({ inspector: null }),
  setApiOpen: (apiOpen) => set(apiOpen ? { ...CLOSED_OVERLAYS, apiOpen: true } : { apiOpen: false }),
  setPaletteOpen: (paletteOpen) => set(paletteOpen ? { ...CLOSED_OVERLAYS, paletteOpen: true } : { paletteOpen: false }),
  setHelpOpen: (helpOpen) => set(helpOpen ? { ...CLOSED_OVERLAYS, helpOpen: true } : { helpOpen: false }),
  openDrawer: (ctx = {}) => set({ ...CLOSED_OVERLAYS, drawer: ctx }),
  closeDrawer: () => set({ drawer: null }),
  setMobileNavOpen: (mobileNavOpen) => set(mobileNavOpen ? { ...CLOSED_OVERLAYS, mobileNavOpen: true } : { mobileNavOpen: false }),
  toast: (t) => set({ toasts: [...get().toasts.slice(-2), { ...t, id: nextToastId++ }] }),
  dismissToast: (id) => {
    const t = get().toasts.find((x) => x.id === id);
    if (!t || t.leaving) return;
    set({ toasts: get().toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x)) });
    // Matches the banner exit and its slot closing (Notices, globals.css).
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 380);
  },
}));
