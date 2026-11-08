"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Plus, RotateCcw } from "lucide-react";
import { compareNoticeVersions, readinessIfPreparedForOriginal } from "@/domain";
import type { Notice, Requirement } from "@/domain/types";
import { DEFAULT_APPLICANT_PROFILE } from "@/data/seed/notices.seed";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { HERO_NOTICE_ID, useScenarios } from "@/hooks/useScenarios";
import { CHAPTER_COLORS, CHAPTER_NAME, chapterOf, kindOf } from "@/lib/chapters";
import { formatDate, isConsequential, isIsoDate, shortTitle, versionTag } from "@/lib/format";
import { wordDiff, type DiffToken } from "@/lib/wordDiff";
import { cn } from "@/lib/utils";
import { Mark } from "./Logo";
import { KindGlyph } from "./NoticeFaces";
import { PaperRow } from "./Visuals";
import { AnimatedNumber, buttonClass } from "./primitives";

/*
 * The Overview hero: NIYOM's whole idea as one short scene that plays by itself.
 *
 * 1. An applicant has prepared every paper for a notice: their folder reads 100%.
 * 2. The notice is corrected: a stamp lands and the changed clauses are struck and rewritten.
 *    The folder still reads 100%, which is the problem.
 * 3. NIYOM's card catches it: readiness falls to what the correction really leaves standing, and it
 *    names the papers to check again and the ones now required.
 *
 * Every figure comes from the readiness engine (`readinessIfPreparedForOriginal`), for each dossier.
 * The scene plays once when it comes into view (about four seconds), then rests; the steps can be
 * replayed or jumped to. With reduced motion it opens on the last step.
 */

const INK = "#1c1b19";
const MUTED = "#6b655b";
const CRIT = "#9a2b1e";
const WARN = "#8a5510";
const OK = "#2d6a47";

const STEPS = ["You prepare every paper", "The notice is quietly corrected", "NIYOM shows what it broke"] as const;
/** When each step starts, in ms after the scene comes into view. */
const AT = [0, 1300, 3000] as const;
const ROWS = 3;

type Step = 0 | 1 | 2;

type Row = {
  id: string;
  /** The clause's number in the notice: the excerpt keeps the gaps of the clauses it leaves out. */
  n: number;
  before?: Requirement;
  after?: Requirement;
  tokens: DiffToken[];
  escalated: boolean;
};

const shown = (r: Requirement) => (r.category === "deadline" && isIsoDate(r.value) ? formatDate(r.value) : r.value);

/** The clauses the sheet shows: the ones the latest update rewrites, then unchanged ones, three in all. Added clauses come last, as a corrigendum appends them. */
function rowsFor(notice: Notice): Row[] {
  const original = notice.versions[0];
  const latest = notice.versions[notice.versions.length - 1];
  const changes = new Map(compareNoticeVersions(original, latest).map((c) => [c.requirementId, c]));
  const ids = [...original.requirements, ...latest.requirements.filter((r) => !original.requirements.some((o) => o.id === r.id))].map((r) => r.id);
  const rows = ids.map((id, k): Row & { matters: boolean } => {
    const before = original.requirements.find((r) => r.id === id);
    const after = latest.requirements.find((r) => r.id === id);
    const escalated = !!before && !!after && !before.mandatory && after.mandatory;
    const rewritten = !!before && !!after && before.value !== after.value;
    const c = changes.get(id);
    const matters = !!c && isConsequential(c) && (!before || !after || rewritten || escalated);
    const tokens: DiffToken[] = !before
      ? [{ kind: "add", text: shown(after!) }]
      : !after
        ? [{ kind: "del", text: shown(before) }]
        : rewritten
          ? wordDiff(shown(before), shown(after))
          : [{ kind: "same", text: shown(after) }];
    return { id, n: k + 1, before, after, tokens, escalated, matters };
  });
  const keep = new Set([...rows.filter((r) => r.matters), ...rows.filter((r) => !r.matters && r.before && r.after)].slice(0, ROWS).map((r) => r.id));
  return rows.filter((r) => keep.has(r.id));
}

/** A generic issuing-office seal in the dossier's colour: two rings and a rosette. */
const ROSETTE = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 ? 5.2 : 10.5;
  const a = (i * Math.PI) / 12 - Math.PI / 2;
  return `${(24 + r * Math.cos(a)).toFixed(2)},${(24 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

function Seal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-11 w-11 flex-none max-sm:hidden" fill="none" stroke={color}>
      <circle cx="24" cy="24" r="22.5" strokeWidth="1.6" strokeOpacity="0.6" />
      <circle cx="24" cy="24" r="18" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="1.6 2.2" />
      <polygon points={ROSETTE} fill={color} fillOpacity="0.16" strokeWidth="1" strokeOpacity="0.7" strokeLinejoin="round" />
    </svg>
  );
}

function Clause({ row, corrected }: { row: Row; corrected: boolean }) {
  const added = !row.before;
  const removed = !row.after;
  const req = (row.after ?? row.before)!;
  const plain = !corrected || row.tokens.every((t) => t.kind === "same");
  return (
    <li className={cn("grid grid-cols-[1.9em_minmax(0,1fr)] py-2", added && !corrected && "invisible")} aria-hidden={(added && !corrected) || undefined}>
      <span className="num pt-px text-[13.5px]" style={{ color: MUTED }}>
        {row.n}.
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold leading-snug sm:text-[14.5px]">
          <span className={cn(corrected && removed && "line-through decoration-[#9a2b1e]/70")}>{req.title}</span>
          {corrected && added && (
            <span className="hero-tag code text-[11.5px]" style={{ color: CRIT }}>
              New
            </span>
          )}
          {corrected && removed && (
            <span className="hero-tag code text-[11.5px]" style={{ color: CRIT }}>
              Removed
            </span>
          )}
          {corrected && row.escalated && (
            <span className="text-[13px] font-normal italic">
              <del className="hero-del no-underline">optional</del> <ins className="hero-ins no-underline">required</ins>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[13.5px] leading-[1.45] sm:text-[14px]" style={plain ? { color: "rgba(28,27,25,0.62)" } : undefined}>
          {plain
            ? shown(corrected ? req : (row.before ?? req))
            : row.tokens.map((t, k) => (
                <span key={k}>
                  {k > 0 && " "}
                  {t.kind === "del" ? (
                    <del className="hero-del no-underline">{t.text}</del>
                  ) : t.kind === "add" ? (
                    <ins className="hero-ins no-underline">{t.text}</ins>
                  ) : (
                    t.text
                  )}
                </span>
              ))}
        </p>
      </div>
    </li>
  );
}

export function HeroScene() {
  const notices = useNiyomStore((s) => s.notices);
  const scenarios = useScenarios();
  const [id, setId] = useState(HERO_NOTICE_ID);
  const [step, setStep] = useState<Step>(0);
  const [run, setRun] = useState(0);
  const stage = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const manual = useRef(false);

  const notice = notices.find((n) => n.id === id) ?? notices[0];
  const original = notice.versions[0];
  const latest = notice.versions[notice.versions.length - 1];
  const chapter = chapterOf(notice.id);
  const name = CHAPTER_NAME[chapter];
  const corrected = step >= 1;
  const alerted = step === 2;

  const rows = useMemo(() => rowsFor(notice), [notice]);
  const before = useMemo(() => readinessIfPreparedForOriginal(notice, original.versionNumber, DEFAULT_APPLICANT_PROFILE), [notice, original]);
  const after = useMemo(() => readinessIfPreparedForOriginal(notice, latest.versionNumber, DEFAULT_APPLICANT_PROFILE), [notice, latest]);
  const summary = alerted ? after : before;
  const papers = summary.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES");
  const affected = papers.filter((i) => i.readinessStatus !== "completed").length;

  // What the card lists: what broke first, then papers that still hold, three lines in all.
  const lines = [
    ...papers.filter((i) => i.readinessStatus === "needs_reverification").map((i) => ({ i, tone: "warn" as const })),
    ...papers.filter((i) => i.readinessStatus === "pending").map((i) => ({ i, tone: "crit" as const })),
    ...papers.filter((i) => i.readinessStatus === "completed").map((i) => ({ i, tone: "ok" as const })),
  ].slice(0, 3);

  const stamp = /corrigendum/i.test(latest.versionLabel) ? "Corrigendum" : /addendum/i.test(latest.versionLabel) ? "Addendum" : "Amended";
  const officialLabel = latest.versionLabel.split(" ").slice(1).join(" ");

  // Play the story once the stage is in view; a click on a step takes over from the timer.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    manual.current = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || manual.current) return;
        io.disconnect();
        if (reduce) {
          setStep(2);
          return;
        }
        timers.current = [window.setTimeout(() => setStep(1), AT[1]), window.setTimeout(() => setStep(2), AT[2])];
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [run]);

  const replay = (noticeId = notice.id) => {
    setId(noticeId);
    setStep(0);
    setRun((r) => r + 1);
  };

  const jump = (s: Step) => {
    manual.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStep(s);
  };

  const tryIt = () => {
    scenarios.simulateCorrigendum(notice.id, latest.versionNumber);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById("action")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  return (
    <div className="grid grid-cols-1 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-center lg:gap-x-14 lg:gap-y-8 xl:gap-x-16">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
        <h1 className="display text-[40px] sm:text-[54px] lg:text-[44px] xl:text-[52px] 2xl:text-[56px]">
          <span className="block">The notice changed.</span>
          <span className="block">Your papers didn’t.</span>
        </h1>
        <p className="mt-5 max-w-[34em] text-[19px] leading-[1.5] text-ink-2 sm:text-[20px]">
          Scholarship and service notices get corrected after you have prepared. NIYOM reads each correction and tells you which of your papers it made wrong, before a counter does.
        </p>
      </div>

      {/* The scene: the official notice, and NIYOM's card about the applicant's folder laid over its foot. */}
      <figure
        ref={stage}
        aria-label={`${shortTitle(notice)}: an applicant who prepared for the original is ${after.percentage}% ready after ${versionTag(latest)}.`}
        className="relative w-full min-w-0 max-w-[600px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:[@media(max-height:800px)]:[zoom:0.84]"
      >
        <div className="mb-4 flex items-center gap-2">
          <div
            aria-label="Play the scene on"
            className="scroll-x -mx-1 flex min-w-0 flex-1 gap-1.5 px-1 py-1 max-sm:overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,#000_84%,transparent)] sm:flex-wrap"
          >
            {notices.map((n) => {
              const on = n.id === notice.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => replay(n.id)}
                  data-cover={on ? chapterOf(n.id) : undefined}
                  className={cn(
                    "flex flex-none items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-[14px] transition-[background-color,color,box-shadow] duration-300",
                    on ? "shadow-[0_8px_18px_-10px_rgba(28,27,25,0.6)]" : "bg-white/50 text-ink-2 hover:bg-white/80 hover:text-ink"
                  )}
                >
                  <KindGlyph kind={kindOf(n.category)} className="h-[18px] w-[18px]" />
                  {CHAPTER_NAME[chapterOf(n.id)]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => replay()}
            aria-label="Replay the scene"
            title="Replay"
            className="grid h-8 w-8 flex-none place-items-center self-start rounded-full text-ink-2 transition-colors hover:bg-white/70 hover:text-ink"
          >
            <RotateCcw aria-hidden strokeWidth={2.2} className="h-4 w-4" />
          </button>
        </div>
        <article
          key={`sheet-${run}`}
          className={cn(corrected ? "hero-thud" : "hero-sheet", "relative w-[95%] rounded-[6px] bg-[#fcfbf8] px-5 pb-14 pt-5 lg:pb-16 shadow-[0_1px_1px_rgba(28,27,25,0.08),0_34px_64px_-30px_rgba(28,27,25,0.5)] sm:w-[88%] sm:px-8 sm:pt-7")}
          style={{ color: INK }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] rounded-t-[6px]" style={{ background: CHAPTER_COLORS[chapter].cover }} />
          <div className="flex items-center gap-3.5 pr-[104px] sm:pr-32">
            <Seal color={CHAPTER_COLORS[chapter].cover} />
            <div className="min-w-0">
              <p className="code truncate text-[12px]" style={{ color: MUTED }}>
                {notice.departmentOrTrust}
              </p>
              <p className="display mt-0.5 text-[21px] leading-tight sm:text-[24px]">{shortTitle(notice)}</p>
            </div>
          </div>
          <p key={`meta-${corrected}`} className="hero-tag mt-4 text-[13.5px] italic" style={{ color: corrected ? CRIT : MUTED }}>
            {corrected ? `${versionTag(latest)} (${officialLabel}), ${formatDate(latest.publishedAt)}` : `Original, ${formatDate(original.publishedAt)}`}
          </p>
          <ol key={`rows-${run}-${corrected}`} className="mt-2 border-t pt-1" style={{ borderColor: "rgba(28,27,25,0.1)" }}>
            {rows.map((r) => (
              <Clause key={r.id} row={r} corrected={corrected} />
            ))}
          </ol>
          {corrected && (
            <span
              aria-hidden
              className="hero-stamp code absolute right-3 top-5 rounded-[5px] border-[2.5px] px-2.5 py-0.5 text-[12.5px] outline outline-1 outline-offset-2 sm:right-7 sm:top-8 sm:px-3 sm:py-1 sm:text-[16px]"
              style={{ color: CRIT, borderColor: CRIT, outlineColor: "rgba(154,43,30,0.45)" }}
            >
              {stamp}
            </span>
          )}
        </article>

        <div className="hero-front relative z-10 -mt-11 ml-auto w-[92%] sm:w-[64%]">
          <div
            key={`card-${run}`}
            className={cn(
              "hero-sheet rounded-[22px] bg-[rgba(252,251,248,0.86)] p-4 text-[#1c1b19] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.7),0_0_0_0.5px_rgba(28,27,25,0.12),0_22px_44px_-18px_rgba(28,27,25,0.42)] backdrop-blur-xl [animation-delay:160ms]",
              alerted && "hero-alert"
            )}
          >
            <div className="flex items-start gap-3" aria-live="polite">
              <span
                aria-hidden
                className={cn(
                  "grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] transition-colors duration-500",
                  alerted && after.percentage < 100 ? "bg-[#9a2b1e] text-white" : "bg-[#1c1b19] text-[#f4f1ea]"
                )}
              >
                <Mark className="h-[22px] w-[22px]" />
              </span>
              <div key={`head-${alerted}`} className="hero-tag min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold leading-[20px]">{alerted ? `${name} changed` : `Your ${name} folder`}</span>
                  <span className="flex-none text-[13px] leading-[20px] text-[#1c1b19]/50">{alerted ? "now" : "NIYOM"}</span>
                </p>
                <p className="mt-0.5 text-[14.5px] leading-[19px] text-[#1c1b19]/72">
                  {alerted
                    ? affected > 0
                      ? `${versionTag(latest)} affects ${affected} of your ${papers.length} papers.`
                      : `${versionTag(latest)} changes nothing you prepared.`
                    : "Every paper matches the notice."}
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-[#1c1b19]/10 pt-3">
              <p className="flex items-baseline gap-1.5">
                <span className={cn("display text-[46px] leading-none transition-colors duration-500", summary.percentage < 100 && "text-crit")}>
                  <AnimatedNumber value={summary.percentage} />
                  <span className="text-[24px]">%</span>
                </span>
                <span className="text-[15px] text-ink-2">ready</span>
              </p>
              <PaperRow
                key={`papers-${run}-${alerted}`}
                className="pb-1.5"
                items={papers.map((i) => ({ id: i.requirement.id, title: i.requirement.title, status: i.readinessStatus }))}
              />
            </div>
            <ul key={`lines-${run}-${alerted}`} className="mt-3 space-y-1.5 text-[14.5px] leading-snug">
              {lines.map(({ i, tone }, k) => (
                <li key={i.requirement.id} className="hero-line flex items-center gap-2.5" style={{ animationDelay: `${120 + k * 90}ms` }}>
                  <span
                    aria-hidden
                    className="grid h-5 w-5 flex-none place-items-center rounded-full"
                    style={{ background: tone === "ok" ? "rgba(45,106,71,0.12)" : tone === "warn" ? "rgba(176,122,28,0.16)" : "rgba(154,43,30,0.12)", color: tone === "ok" ? OK : tone === "warn" ? WARN : CRIT }}
                  >
                    {tone === "ok" ? <Check strokeWidth={3} className="h-3 w-3" /> : tone === "warn" ? <AlertTriangle strokeWidth={2.6} className="h-3 w-3" /> : <Plus strokeWidth={3} className="h-3 w-3" />}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", tone === "ok" && "text-[#1c1b19]/70")}>{i.requirement.title}</span>
                  {tone !== "ok" && (
                    <span className="flex-none text-[13px] font-semibold" style={{ color: tone === "warn" ? WARN : CRIT }}>
                      {tone === "warn" ? "Check again" : "New"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </figure>

      <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
        <ol aria-label="What the scene shows" className="grid gap-0.5">
          {STEPS.map((label, k) => {
            const s = k as Step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => jump(s)}
                  aria-current={step === s ? "step" : undefined}
                  className="group flex items-center gap-3 rounded-[10px] py-1 pr-2 text-left text-[17px] leading-snug"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "num grid h-7 w-7 flex-none place-items-center rounded-full border text-[13.5px] transition-[background-color,border-color,color] duration-500",
                      step === s ? "border-ink bg-ink text-paper" : step > s ? "border-ink/40 text-ink" : "border-ink/20 text-ink-3 group-hover:border-ink/45"
                    )}
                  >
                    {step > s ? <Check strokeWidth={2.6} className="h-3.5 w-3.5" /> : k + 1}
                  </span>
                  <span className={cn("transition-colors duration-500", step === s ? "font-semibold text-ink" : step > s ? "text-ink-2" : "text-ink-3 group-hover:text-ink-2")}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="button" onClick={tryIt} className={buttonClass("primary")}>
            Try it on my checklist
          </button>
          <Link href="/my-plan" className="text-[16px] font-semibold underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink">
            Open my plan
          </Link>
        </div>

      </div>
    </div>
  );
}
