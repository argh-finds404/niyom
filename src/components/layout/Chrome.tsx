"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useScenarios } from "@/hooks/useScenarios";
import { useAllIntelligence, useDossierIntelligence } from "@/hooks/useDossierIntelligence";
import { chapterOf } from "@/lib/chapters";
import { isConsequential, shortTitle, versionTag } from "@/lib/format";
import { Button, Overlay, Skel } from "@/components/ui/primitives";
import { Logo, Mark } from "@/components/ui/Logo";
import { AlertsButton } from "./Alerts";

/* ───────────── Navigation model ───────────── */

function useNav() {
  const pathname = usePathname();
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const intel = useDossierIntelligence();
  const changes = intel ? intel.versionChanges.filter(isConsequential).length : 0;
  const s = intel?.readinessSummary;

  return [
    { href: "/", label: "Overview", on: pathname === "/" },
    { href: "/explore", label: "Directory", on: pathname.startsWith("/explore") },
    { href: `/notice/${activeNoticeId}`, label: "Specification", on: pathname.startsWith("/notice/") },
    {
      href: `/changes/${activeNoticeId}`,
      label: "Changes",
      on: pathname.startsWith("/changes/"),
      count: changes > 0 ? <span className="num text-crit">{changes}</span> : null,
      countLabel: `${changes} changes that matter`,
    },
    {
      href: "/my-plan",
      label: "My plan",
      on: pathname.startsWith("/my-plan"),
      count: !hydrated ? (
        <Skel className="h-3.5 w-7" />
      ) : s ? (
        <span className={cn("num", s.staleReverificationCount ? "text-warn" : "text-ink-3")}>{s.percentage}%</span>
      ) : null,
      countLabel: s ? `${s.percentage}% ready` : undefined,
    },
  ];
}

/* ───────────── Walkthrough (a popover, not a permanent bar) ───────────── */

function WalkthroughList({ onDone }: { onDone?: () => void }) {
  const stage = useNiyomStore((s) => s.demoScenarioStage);
  const pathname = usePathname();
  const s = useScenarios();
  const steps: [string, string, () => void, boolean][] = [
    ["Start prepared on v1.0", "Every required Merit Grant item checked against the original circular.", s.baseline, stage === "v1_ready"],
    ["A corrigendum arrives", "Version 2.0 is published. Watch which of your checks it invalidates.", s.simulateCorrigendum, stage === "v2_updated"],
    ["The railway refund case", "Two official sources disagree, and applicants report delays.", s.openRailway, pathname.startsWith("/notice/service-railway-refund")],
  ];
  return (
    <ol className="space-y-1">
      {steps.map(([title, body, run, on], i) => (
        <li key={title}>
          <button
            type="button"
            onClick={() => {
              run();
              onDone?.();
            }}
            aria-pressed={on}
            className={cn(
              "group flex w-full gap-3 rounded-[var(--r-card)] p-3 text-left transition-colors duration-200",
              on ? "bg-[#1c1b19]/[0.06]" : "hover:bg-[#1c1b19]/[0.04]"
            )}
          >
            <span
              className={cn(
                "num grid h-7 w-7 flex-none place-items-center rounded-full border text-[14px] transition-colors",
                on ? "border-[#1c1b19] bg-[#1c1b19] text-[#f2f1ed]" : "border-[#1c1b19]/25 text-[#47433c]"
              )}
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-[16.5px] font-semibold leading-snug">{title}</span>
              <span className="block text-[14.5px] leading-snug text-[#6b655b]">{body}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function WalkthroughButton() {
  const s = useScenarios();
  return (
    <>
      <button
        type="button"
        popoverTarget="walkthrough"
        className="hidden h-10 items-center gap-2 rounded-[var(--r-control)] px-3 text-[15.5px] italic text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink md:inline-flex"
      >
        Walkthrough
      </button>
      <div
        id="walkthrough"
        popover="auto"
        className="pop fixed right-3 top-[calc(var(--bar-h)-6px)] w-[min(380px,calc(100vw-24px))] rounded-[var(--r-panel)] bg-[#fcfbf8] p-2 text-[#1c1b19] shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_24px_60px_-20px_rgba(28,27,25,0.35)] sm:right-6"
      >
        <p className="px-3 pb-1 pt-3 text-[15px] italic text-[#6b655b]">Three steps show what NIYOM does</p>
        <WalkthroughList onDone={() => document.getElementById("walkthrough")?.hidePopover()} />
        <div className="mt-1 flex justify-end border-t border-[#1c1b19]/10 px-2 pt-2">
          <button
            type="button"
            onClick={() => {
              s.reset();
              document.getElementById("walkthrough")?.hidePopover();
            }}
            className="rounded-[var(--r-control)] px-3 py-1.5 text-[14.5px] italic text-[#6b655b] transition-colors hover:bg-[#1c1b19]/[0.05] hover:text-[#1c1b19]"
          >
            Reset the demo
          </button>
        </div>
      </div>
    </>
  );
}

/* ───────────── Top bar ───────────── */

export function TopBar() {
  const nav = useNav();
  const openDrawer = useUiStore((s) => s.openDrawer);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const next = window.scrollY > 8;
      if (next !== scrolledRef.current) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={cn(
        // Always opaque: content must never show through the bar while scrolling.
        "sticky top-0 z-50 -ml-[var(--rail-w)] bg-ground pl-[var(--rail-w)] transition-[background-color,box-shadow] duration-500 print:hidden",
        scrolled && "shadow-[0_1px_0_color-mix(in_srgb,var(--ink)_12%,transparent),0_10px_24px_-20px_rgba(28,27,25,0.35)]"
      )}
    >
      <div className="mx-auto flex h-[var(--bar-h)] max-w-[1240px] items-center gap-6 pl-3 pr-4 sm:px-8 lg:px-10">
        <Link href="/" aria-label="NIYOM overview" className="flex flex-none items-center gap-2.5">
          <Mark draw className="h-8 w-8" />
          <span className="text-[15.5px] font-semibold tracking-[0.16em]">NIYOM</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-0.5 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              aria-current={n.on ? "page" : undefined}
              aria-label={n.countLabel ? `${n.label}, ${n.countLabel}` : undefined}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-[var(--r-control)] px-3 text-[16px] transition-colors duration-200",
                n.on ? "bg-ink/[0.07] text-ink" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink"
              )}
            >
              {n.label}
              {n.count && <span className="text-[14px]">{n.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search (Ctrl K)"
            className="grid h-10 w-10 place-items-center rounded-[var(--r-control)] text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <AlertsButton />
          <WalkthroughButton />
          <Button size="sm" className="ml-1 hidden xl:inline-flex" onClick={() => openDrawer({ noticeId: activeNoticeId })}>
            Report a change
          </Button>
          <Button variant="ghost" size="sm" aria-label="Open menu" className="lg:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export function TopBarFallback() {
  return <div className="sticky top-0 z-50 h-[var(--bar-h)] bg-ground" />;
}

/* ───────────── Mobile menu: the book's contents page ───────────── */

export function MobileMenu() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const setApiOpen = useUiStore((s) => s.setApiOpen);
  const nav = useNav();
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const close = () => setOpen(false);

  return (
    <Overlay open={open} onClose={close} label="Menu" placement="top">
      <div className="ov-top flex h-full flex-col overflow-y-auto bg-ground">
        <div className="flex h-[var(--bar-h)] flex-none items-center justify-between px-5">
          <Logo className="[&_svg]:h-7 [&_svg]:w-7" />
          <Button variant="ghost" size="sm" aria-label="Close menu" onClick={close}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 px-5 pb-10">
          <nav aria-label="Primary">
            <ul>
              {nav.map((n) => (
                <li key={n.label} className="border-b border-ink/10">
                  <Link href={n.href} onClick={close} aria-current={n.on ? "page" : undefined} className="flex min-h-14 items-baseline justify-between gap-4 py-3">
                    <span className={cn("display text-[30px]", !n.on && "text-ink-2")}>{n.label}</span>
                    {n.count && <span className="text-[17px]">{n.count}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-10 text-[16px] italic text-ink-3">Your dossiers</p>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {all.map(({ notice, activeVersion, readinessSummary: s }) => (
              <li key={notice.id}>
                <Link
                  href={`/notice/${notice.id}`}
                  onClick={() => {
                    setActiveNotice(notice.id);
                    close();
                  }}
                  data-cover={chapterOf(notice.id)}
                  className={cn(
                    "flex h-24 flex-col justify-between rounded-[var(--r-card)] p-3 transition-transform active:scale-[0.98]",
                    notice.id === activeNoticeId && "ring-2 ring-ink ring-offset-2 ring-offset-ground"
                  )}
                >
                  <span className="code text-[13px] text-ink-2">{versionTag(activeVersion.versionLabel)}</span>
                  <span>
                    <span className="block text-[15px] font-semibold leading-tight">{shortTitle(notice)}</span>
                    <span className="num text-[13px] italic text-ink-2">{hydrated ? `${s.percentage}% ready` : "…"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[16px] italic text-ink-3">Walkthrough</p>
          <div className="mt-2 rounded-[var(--r-panel)] bg-[#fcfbf8] p-1.5 text-[#1c1b19]">
            <WalkthroughList onDone={close} />
          </div>

          <div className="mt-8 grid gap-2">
            <Button variant="primary" onClick={() => openDrawer({ noticeId: activeNoticeId })}>
              Report a change
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setHelpOpen(true)}>How it works</Button>
              <Button onClick={() => setApiOpen(true)}>Live API</Button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ───────────── Footer: the colophon ───────────── */

/** Where your work is right now, in one sentence. */
function SyncStatus() {
  const status = useNiyomStore((s) => s.backendStatus);
  const at = useNiyomStore((s) => s.lastSyncedAt);
  const time = at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <p className="mt-4" role="status" aria-live="polite">
      {status === "online"
        ? `Your checklist is saved on this device and backed up to the NIYOM server${time ? `, last at ${time}` : ""}.`
        : status === "offline"
          ? "Offline. Your changes are saved on this device and will be sent when the connection returns."
          : "Connecting to the NIYOM server…"}
    </p>
  );
}

export function Footer() {
  const setApiOpen = useUiStore((s) => s.setApiOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const status = useNiyomStore((s) => s.backendStatus);
  return (
    <footer className="print:hidden">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-12 pt-20 sm:px-8 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <p className="flex items-center gap-4">
            <Mark className="h-14 w-14" />
            <span className="text-[44px] font-semibold leading-none tracking-[0.14em] sm:text-[56px]">NIYOM</span>
          </p>
          <p className="mt-4 text-[21px] italic text-ink-2">
            Be ready. Not just informed. <span className="font-bengali not-italic text-ink-3">নিয়ম</span>
          </p>
        </div>
        <div className="max-w-[44ch] self-end text-[15px] leading-relaxed text-ink-3 md:text-right">
          <p className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
            <button type="button" onClick={() => setApiOpen(true)} className="tap inline-flex items-center gap-2 text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              <span
                aria-hidden
                className={cn("h-2 w-2 rounded-full", status === "online" ? "bg-ok" : status === "offline" ? "bg-warn" : "bg-ink-3")}
              />
              Live API
            </button>
            <button type="button" onClick={() => setHelpOpen(true)} className="tap text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              How NIYOM works
            </button>
          </p>
          <SyncStatus />
          <p className="mt-1">
            The dossiers are sample cases modelled on published notices. NIYOM is not affiliated with any institution named; always confirm with
            the issuing office before you submit.
          </p>
        </div>
      </div>
    </footer>
  );
}
