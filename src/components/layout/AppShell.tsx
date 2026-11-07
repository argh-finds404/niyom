"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useWatchStore } from "@/hooks/useWatchStore";
import { Footer, MobileMenu, TopBar, TopBarFallback } from "./Chrome";
import { Rail } from "./Rail";
import { CommandPalette } from "./CommandPalette";
import { DiscrepancyDrawer } from "./DiscrepancyDrawer";
import { HelpSheet } from "./HelpSheet";
import { ApiInspector } from "./ApiInspector";
import { Notices } from "./Notices";
import { Inspector } from "@/components/ledger/Inspector";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useNiyomStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    // Follow state lives in localStorage; restore it before the dossiers so alerts appear together.
    void useWatchStore.persist.rehydrate();
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setPaletteOpen(!ui.paletteOpen);
      } else if (e.key === "?" && !typing) {
        useUiStore.getState().setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-2 z-[70] -translate-y-20 rounded-[var(--r-control)] bg-ink px-3 py-2 text-[15px] text-ground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <Rail />
      </Suspense>
      <div className="flex min-h-screen flex-col pl-[var(--rail-w)]">
        <Suspense fallback={<TopBarFallback />}>
          <TopBar />
          <MobileMenu />
        </Suspense>
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
      <CommandPalette />
      <DiscrepancyDrawer />
      <Inspector />
      <HelpSheet />
      <ApiInspector />
      <Notices />
    </>
  );
}
