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

/** Ephemeral UI state only. Domain state lives in useNiyomStore. */
export const useUiStore = create<UiState>((set, get) => ({
  inspector: null,
  apiOpen: false,
  openInspector: (inspector) => set({ inspector, paletteOpen: false, mobileNavOpen: false }),
  closeInspector: () => set({ inspector: null }),
  setApiOpen: (apiOpen) => set({ apiOpen, mobileNavOpen: false }),
  paletteOpen: false,
  helpOpen: false,
  drawer: null,
  mobileNavOpen: false,
  toasts: [],
  setPaletteOpen: (paletteOpen) => set({ paletteOpen, mobileNavOpen: false }),
  setHelpOpen: (helpOpen) => set({ helpOpen, mobileNavOpen: false }),
  openDrawer: (ctx = {}) => set({ drawer: ctx, paletteOpen: false, mobileNavOpen: false }),
  closeDrawer: () => set({ drawer: null }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  toast: (t) => set({ toasts: [...get().toasts.slice(-2), { ...t, id: nextToastId++ }] }),
  dismissToast: (id) => {
    const t = get().toasts.find((x) => x.id === id);
    if (!t || t.leaving) return;
    set({ toasts: get().toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x)) });
    // Matches the banner exit and its slot closing (Notices, globals.css).
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 380);
  },
}));
