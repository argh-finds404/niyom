"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useScenarios } from "@/hooks/useScenarios";
import { useAllIntelligence, useDossierIntelligence } from "@/hooks/useDossierIntelligence";
import { chapterOf } from "@/lib/chapters";
import { formatDate, isConsequential, shortTitle, versionTag } from "@/lib/format";
import { daysPhrase, daysUntil, deadlineOf } from "@/lib/deadline";
import { Button, Overlay, Skel } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
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
    ["Start prepared on the original", "Every required Merit Grant item checked against the original circular.", s.baseline, stage === "v1_ready"],
    ["A corrigendum arrives", "An update to the notice is published. Watch which of your checks it invalidates.", s.simulateCorrigendum, stage === "v2_updated"],
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
        className="pop fixed right-3 top-[calc(var(--bar-h)-6px)] max-h-[calc(100dvh-var(--bar-h)-16px)] w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-[var(--r-panel)] bg-[#fcfbf8] p-2 text-[#1c1b19] shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_24px_60px_-20px_rgba(28,27,25,0.35)] sm:right-6"
      >
        <p className="px-3 pb-1 pt-3 text-[15px] italic text-[#6b655b]">Three steps show what NIYOM does</p>
        <WalkthroughList onDone={() => document.getElementById("walkthrough")?.hidePopover()} />
        <div className="mt-1 flex justify-end border-t border-[#1c1b19]/10 px-2 pt-2">
          <ConfirmAction
            label="Reset the demo"
            confirmLabel="Confirm reset?"
            ariaLabel="Reset the demo"
            onConfirm={() => {
              s.reset();
              document.getElementById("walkthrough")?.hidePopover();
            }}
            className="italic text-[#6b655b] hover:bg-[#1c1b19]/[0.05] hover:text-[#1c1b19]"
          />
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
        // A full bar at the top of the page; once you scroll it tucks into a floating pill. Its height never
        // changes, so nothing below it moves, and the strip around the pill lets clicks through.
        "sticky top-0 z-50 -ml-[var(--rail-w)] h-[var(--bar-h)] pl-[var(--rail-w)] transition-colors duration-500 print:hidden",
        scrolled ? "pointer-events-none bg-transparent" : "bg-ground"
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex items-center gap-6 transition-[max-width,height,margin,border-radius,background-color,box-shadow,padding] duration-500 ease-spring",
          scrolled
            ? "mx-2 mt-[7px] h-[calc(var(--bar-h)-14px)] max-w-[1180px] rounded-full bg-ground/85 pl-3 pr-2 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent),0_14px_34px_-18px_rgba(28,27,25,0.4)] backdrop-blur-xl backdrop-saturate-150 sm:mx-4 sm:pl-5 sm:pr-3 xl:mx-auto"
            : "h-full max-w-[1240px] rounded-none pl-3 pr-4 sm:px-8 lg:px-10"
        )}
      >
        <Link href="/" aria-label="NIYOM overview" className="flex flex-none items-center gap-2.5">
          <Mark draw className="h-8 w-8" />
          <span className="text-[15.5px] font-semibold tracking-[0.16em]">NIYOM</span>
          <span aria-hidden className="hidden border-l border-ink/20 pl-2.5 font-bengali text-[15px] leading-none text-ink-3 sm:inline">
            নিয়ম
          </span>
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
                  <span className="code text-[13px] text-ink-2">{versionTag(activeVersion)}</span>
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

/** The next closing date across every dossier: the one thing worth remembering on the way out. */
function NextClosing() {
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  // "Today" is read only after hydration, so the server and first client render agree.
  const next = hydrated
    ? all
        .map(({ notice, activeVersion }) => {
          const d = deadlineOf(activeVersion);
          return d ? { notice, version: activeVersion, date: d.date, days: daysUntil(d.date) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null && x.days >= 0)
        .sort((x, y) => x.days - y.days)[0]
    : undefined;
  if (!next) return <p className="min-h-[1.6em]">{hydrated ? "No open deadlines in your dossiers." : ""}</p>;
  return (
    <p>
      <CalendarClock aria-hidden className="mr-2 inline h-4 w-4 -translate-y-px text-cover-ink/60" />
      <span>
        Next to close:{" "}
        <Link href={`/notice/${next.notice.id}`} onClick={() => setActiveNotice(next.notice.id)} className="link-draw font-semibold text-cover-ink">
          {shortTitle(next.notice)}
        </Link>
        , {formatDate(next.date)}, {daysPhrase(next.days)}.
      </span>{" "}
      <a href={`/api/calendar/${next.notice.id}?version=${next.version.versionNumber}`} download className="link-draw text-cover-ink/80 hover:text-cover-ink">
        Add to calendar
      </a>
    </p>
  );
}

const FOOT_LINK = "tap link-draw text-cover-ink/80 transition-colors hover:text-cover-ink";

/** The colophon: the promise, every way back in, where your work is, and the name, large. */
export function Footer() {
  const setApiOpen = useUiStore((s) => s.setApiOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const all = useAllIntelligence();

  return (
    <footer className="-ml-[var(--rail-w)] flex min-h-dvh flex-col overflow-hidden bg-cover pl-[var(--rail-w)] text-cover-ink transition-colors duration-700 print:hidden">
      {/* Fills the screen at the end of the page: the floating bar sits over the footer itself, never over the band above. */}
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pb-3 pt-[calc(var(--bar-h)+20px)] sm:px-8 sm:pb-7 sm:pt-[calc(var(--bar-h)+80px)] lg:px-10">
        <div className="grid grid-cols-1 gap-x-16 gap-y-7 sm:gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <div>
            <p className="display max-w-[16ch] text-[30px] sm:text-[52px]">Be ready. Not just informed.</p>
            <p className="mt-5 hidden max-w-[46ch] text-[18px] leading-relaxed text-cover-ink/75 sm:block">
              NIYOM keeps every version of a notice and tells you when a change makes the papers you already prepared wrong.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-7 text-[16px] sm:grid-cols-3 sm:gap-y-10">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[15px] italic text-cover-ink/60">Dossiers</p>
              <ul className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2.5">
                {all.map(({ notice, readinessSummary: s }) => (
                  <li key={notice.id}>
                    <Link href={`/notice/${notice.id}`} onClick={() => setActiveNotice(notice.id)} className="tap group flex items-baseline justify-between gap-3 text-cover-ink/80 transition-colors hover:text-cover-ink">
                      <span className="link-draw">{shortTitle(notice)}</span>
                      <span className="num flex-none text-[14px] text-cover-ink/55">{hydrated ? `${s.percentage}%` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[15px] italic text-cover-ink/60">Pages</p>
              <ul className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2.5">
                {[
                  ["/", "Overview"],
                  ["/explore", "Directory"],
                  [`/changes/${activeNoticeId}`, "What changed"],
                  ["/my-plan", "My plan"],
                ].map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className={FOOT_LINK}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[15px] italic text-cover-ink/60">Tools</p>
              <ul className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2.5">
                <li>
                  <button type="button" onClick={() => setPaletteOpen(true)} className={FOOT_LINK}>
                    Search <span className="text-[13.5px] text-cover-ink/50">Ctrl K</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => openDrawer({ noticeId: activeNoticeId })} className={FOOT_LINK}>
                    Report a change
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setHelpOpen(true)} className={FOOT_LINK}>
                    How NIYOM works
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setApiOpen(true)} className={FOOT_LINK}>
                    Live API
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div aria-hidden className="h-4 flex-none sm:h-16" />

        <div className="mt-auto grid grid-cols-1 gap-x-16 gap-y-2.5 border-t border-current/15 pt-5 text-[13.5px] sm:gap-y-3 sm:pt-6 sm:text-[14.5px] leading-relaxed text-cover-ink/65 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <NextClosing />
          <p>
            The dossiers, offices and lead times are sample cases modelled on published notices. NIYOM is not affiliated with any
            institution named; always confirm with the issuing office before you submit.
          </p>
        </div>

        {/* The name, set large and cut by the bottom edge, so the whole footer fits on one screen. */}
        <div aria-hidden className="mt-5 h-[clamp(46px,12vw,164px)] flex-none select-none overflow-hidden sm:mt-12">
          <p className="flex items-start justify-between gap-4 leading-none">
            <span className="text-[clamp(56px,14.6vw,200px)] font-semibold tracking-[0.06em]">NIYOM</span>
            <span className="font-bengali mt-[0.12em] text-[clamp(26px,6vw,84px)] leading-none text-cover-ink/55">নিয়ম</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
