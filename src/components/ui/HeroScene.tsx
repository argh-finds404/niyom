"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, Landmark } from "lucide-react";
import { compareNoticeVersions, getRequirementOfficeMeta, readinessIfPreparedForOriginal } from "@/domain";
import type { Notice, Requirement, RequirementChange } from "@/domain/types";
import type { RequirementOfficeMeta } from "@/domain/readiness/intelligence";
import { DEFAULT_APPLICANT_PROFILE } from "@/data/seed/notices.seed";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { HERO_NOTICE_ID, useScenarios } from "@/hooks/useScenarios";
import { CHAPTER_COLORS, CHAPTER_NAME, chapterOf, kindOf } from "@/lib/chapters";
import { formatDate, isConsequential, isIsoDate, plural, shortTitle, versionTag } from "@/lib/format";
import { wordDiff, type DiffToken } from "@/lib/wordDiff";
import { cn } from "@/lib/utils";
import { KindGlyph } from "./NoticeFaces";
import { PaperRow } from "./Visuals";
import { AnimatedNumber, buttonClass } from "./primitives";

/*
 * The Overview hero: NIYOM's whole idea, played by the visitor.
 *
 * A notice sits on the desk with its published versions as a switch. The applicant had prepared every
 * paper for the original. Switching to a later version rewrites the clauses it changed (struck, then
 * replaced), stamps the sheet, and the readiness meter beside it falls by exactly what that version
 * invalidates. Every figure comes from the readiness engine (`readinessIfPreparedForOriginal`), for each
 * of the four dossiers; "Try it on my checklist" then plays the same update on the visitor's own plan.
 */

const INK = "#1c1b19";
const MUTED = "#6b655b";
const CRIT = "#a63a2a";
const ROWS = 5;

type Row = {
  id: string;
  /** The clause as it reads in the selected version, or as it last read if this version removed it. */
  req: Requirement;
  state: "same" | "changed" | "cosmetic" | "added" | "removed" | "later";
  tokens: DiffToken[];
  escalated: boolean;
};

/** Where a paper comes from, in one sentence. */
const counter = (o: RequirementOfficeMeta) =>
  o.leadDays > 0
    ? `From ${o.office}, about ${plural(o.leadDays, "working day")}.`
    : o.office
      ? `Done at ${o.office}; nothing to collect at a counter.`
      : "Nothing to collect at a counter.";

const shown = (r: Requirement) => (r.category === "deadline" && isIsoDate(r.value) ? formatDate(r.value) : r.value);

/** The clauses worth showing: every one that any update touches, then the first others, in notice order, five at least. */
function clauseIds(notice: Notice): string[] {
  const original = notice.versions[0];
  const latest = notice.versions[notice.versions.length - 1];
  const touched = new Set(
    notice.versions.slice(1).flatMap((v) => compareNoticeVersions(original, v).filter((c) => c.type !== "unchanged").map((c) => c.requirementId))
  );
  const order = [...latest.requirements.map((r) => r.id), ...original.requirements.map((r) => r.id).filter((id) => !latest.requirements.some((r) => r.id === id))];
  const keep = new Set([...order.filter((id) => touched.has(id)), ...order.filter((id) => !touched.has(id))].slice(0, Math.max(ROWS, touched.size)));
  return order.filter((id) => keep.has(id));
}

function rowsFor(notice: Notice, ids: string[], versionNumber: number): Row[] {
  const original = notice.versions[0];
  const version = notice.versions.find((v) => v.versionNumber === versionNumber) ?? original;
  const changes = new Map<string, RequirementChange>(compareNoticeVersions(original, version).map((c) => [c.requirementId, c]));
  return ids.flatMap((id): Row[] => {
    const before = original.requirements.find((r) => r.id === id);
    const now = version.requirements.find((r) => r.id === id);
    if (!now && !before) {
      const later = notice.versions.flatMap((v) => v.requirements).find((r) => r.id === id);
      return later ? [{ id, req: later, state: "later", tokens: [], escalated: false }] : [];
    }
    if (now && !before) return [{ id, req: now, state: "added", tokens: [{ kind: "add", text: shown(now) }], escalated: false }];
    if (!now && before) return [{ id, req: before, state: "removed", tokens: [{ kind: "del", text: shown(before) }], escalated: false }];
    const c = changes.get(id);
    const tokens: DiffToken[] = before!.value === now!.value ? [{ kind: "same", text: shown(now!) }] : wordDiff(shown(before!), shown(now!));
    const state: Row["state"] = !c || c.type === "unchanged" ? "same" : isConsequential(c) ? "changed" : "cosmetic";
    return [{ id, req: now!, state, tokens, escalated: !before!.mandatory && now!.mandatory }];
  });
}

function Tokens({ tokens, soft }: { tokens: DiffToken[]; soft?: boolean }) {
  return tokens.map((t, k) => (
    <span key={k}>
      {k > 0 && " "}
      {t.kind === "del" ? (
        <del className={cn("no-underline", soft ? "hero-del-soft" : "hero-del")}>{t.text}</del>
      ) : t.kind === "add" ? (
        <ins className={cn("no-underline", soft ? "hero-ins-soft" : "hero-ins")}>{t.text}</ins>
      ) : (
        t.text
      )}
    </span>
  ));
}

export function HeroScene() {
  const notices = useNiyomStore((s) => s.notices);
  const scenarios = useScenarios();
  const [id, setId] = useState(HERO_NOTICE_ID);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState(false);

  const notice = notices.find((n) => n.id === id) ?? notices[0];
  const original = notice.versions[0];
  const latest = notice.versions[notice.versions.length - 1];
  const versionNumber = picked[notice.id] ?? original.versionNumber;
  const version = notice.versions.find((v) => v.versionNumber === versionNumber) ?? original;
  const colors = CHAPTER_COLORS[chapterOf(notice.id)];

  const ids = useMemo(() => clauseIds(notice), [notice]);
  const rows = useMemo(() => rowsFor(notice, ids, versionNumber), [notice, ids, versionNumber]);
  const summary = useMemo(() => readinessIfPreparedForOriginal(notice, versionNumber, DEFAULT_APPLICANT_PROFILE), [notice, versionNumber]);

  const papers = summary.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES");
  const stale = summary.staleReverificationCount;
  const added = papers.filter((i) => i.readinessStatus === "pending").length;
  const matters = rows.some((r) => r.state === "changed" || r.state === "added" || r.state === "removed");
  const updated = versionNumber !== original.versionNumber;
  const stamp = /corrigendum/i.test(version.versionLabel) ? "Corrigendum" : /addendum/i.test(version.versionLabel) ? "Addendum" : "Amended";
  const run = `${notice.id}-${versionNumber}`;

  const pick = (v: number) => {
    setTouched(true);
    setPicked((p) => ({ ...p, [notice.id]: v }));
  };

  const tryIt = () => {
    if (updated) scenarios.simulateCorrigendum(notice.id, versionNumber);
    else scenarios.baseline(notice.id);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById("action")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-y-7">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:pt-[clamp(0px,calc((100svh-650px)/4),48px)]">
        <h1 className="display text-[42px] sm:text-[54px] xl:text-[58px]">Be ready. Not just informed.</h1>
        <p className="mt-4 text-[20px] italic leading-snug text-ink-2 sm:text-[22px]">
          Notices change quietly. NIYOM tells you when a change makes your prepared documents wrong.
        </p>
      </div>

      {/* The notice on the desk, with its versions as a switch. */}
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div role="tablist" aria-label="Dossier" className="scroll-x -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3 max-sm:[mask-image:linear-gradient(to_right,#000_82%,transparent)]">
          {notices.map((n) => {
            const on = n.id === notice.id;
            return (
              <button
                key={n.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="hero-sheet"
                onClick={() => setId(n.id)}
                data-cover={on ? chapterOf(n.id) : undefined}
                className={cn(
                  "flex flex-none items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-[14.5px] transition-[background-color,color,box-shadow] duration-300",
                  on ? "shadow-[0_8px_18px_-10px_rgba(28,27,25,0.6)]" : "bg-white/45 text-ink-2 hover:bg-white/75 hover:text-ink"
                )}
              >
                <KindGlyph kind={kindOf(n.category)} className="h-5 w-5" />
                {CHAPTER_NAME[chapterOf(n.id)]}
              </button>
            );
          })}
        </div>

        <article
          id="hero-sheet"
          role="tabpanel"
          aria-label={`${shortTitle(notice)}, ${versionTag(version)}`}
          className="hero-sheet relative w-full max-w-[600px] rounded-[6px] bg-[#fcfbf8] px-5 pb-6 pt-5 shadow-[0_1px_1px_rgba(28,27,25,0.08),0_34px_64px_-30px_rgba(28,27,25,0.5)] sm:px-8 sm:pb-7 sm:pt-7"
          style={{ color: INK }}
        >
          <span aria-hidden className="block h-[3px] w-12 rounded-full transition-colors duration-500" style={{ background: colors.cover }} />
          <p className="code mt-3.5 truncate pr-28 text-[12px] sm:pr-36" style={{ color: MUTED }}>
            {notice.departmentOrTrust}
          </p>
          <p className="display mt-0.5 pr-24 text-[24px] leading-tight sm:pr-32 sm:text-[28px]">{shortTitle(notice)}</p>

          <div
            role="radiogroup"
            aria-label="Published version"
            className="mt-4 grid gap-1 rounded-[11px] bg-[#1c1b19]/[0.06] p-1"
            style={{ gridTemplateColumns: `repeat(${notice.versions.length}, minmax(0, 1fr))` }}
          >
            {notice.versions.map((v) => {
              const on = v.versionNumber === versionNumber;
              const hint = !touched && v.versionNumber === latest.versionNumber && !on;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(v.versionNumber)}
                  className={cn(
                    "relative rounded-[8px] px-2 py-1.5 text-left transition-[background-color,color,box-shadow] duration-300",
                    on ? "bg-[#1c1b19] text-[#f4f1ea] shadow-[0_6px_14px_-8px_rgba(28,27,25,0.8)]" : "hover:bg-white/80",
                    hint && "hero-hint"
                  )}
                >
                  <span className="block text-[14.5px] font-semibold leading-tight">{versionTag(v)}</span>
                  <span className={cn("block text-[12.5px] italic leading-tight", on ? "text-[#f4f1ea]/70" : "text-[#6b655b]")}>{formatDate(v.publishedAt)}</span>
                </button>
              );
            })}
          </div>

          <ol key={run} className="mt-4 border-t pt-1" style={{ borderColor: "rgba(28,27,25,0.1)" }}>
            {rows.map((r, k) => {
              const office = getRequirementOfficeMeta(r.id, versionNumber);
              const muted = r.state === "same" || r.state === "later";
              return (
                <li
                  key={r.id}
                  className={cn(
                    "group relative grid transition-[grid-template-rows,opacity] duration-500 ease-spring",
                    r.state === "later" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
                  )}
                  aria-hidden={r.state === "later" || undefined}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div
                      tabIndex={r.state === "later" ? -1 : 0}
                      aria-label={`${r.req.title}. ${counter(office)}`}
                      className="grid cursor-help grid-cols-[1.6em_minmax(0,1fr)] rounded-[6px] py-2 outline-none focus-visible:bg-[#1c1b19]/[0.05]"
                    >
                      <span className="num pt-px text-[14px]" style={{ color: MUTED }}>
                        {k + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold leading-snug">
                          <span
                            className={cn(r.state === "removed" && "line-through decoration-[#a63a2a]/70")}
                            style={muted ? { color: "rgba(28,27,25,0.55)" } : undefined}
                          >
                            {r.req.title}
                          </span>
                          {r.state === "added" && (
                            <span className="hero-tag code text-[11.5px]" style={{ color: CRIT }}>
                              New
                            </span>
                          )}
                          {r.state === "removed" && (
                            <span className="hero-tag code text-[11.5px]" style={{ color: CRIT }}>
                              Removed
                            </span>
                          )}
                          {r.state === "cosmetic" && (
                            <span className="hero-tag code text-[11.5px]" style={{ color: MUTED }}>
                              Cosmetic
                            </span>
                          )}
                          {r.escalated && (
                            <span className="text-[13px] font-normal italic">
                              <del className="hero-del no-underline">optional</del> <ins className="hero-ins no-underline">required</ins>
                            </span>
                          )}
                        </p>
                        <p className={cn("mt-0.5 text-[14.5px] leading-snug", muted && "line-clamp-1")} style={muted ? { color: "rgba(28,27,25,0.45)" } : undefined}>
                          {muted ? shown(r.req) : <Tokens tokens={r.tokens} soft={r.state === "cosmetic"} />}
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Where the paper comes from, on hover or focus. */}
                  <span aria-hidden className="pointer-events-none absolute bottom-[calc(100%-4px)] right-0 z-10 w-max max-w-[min(280px,80%)] translate-y-1 rounded-[10px] bg-[#1c1b19] px-3 py-2 text-[13px] leading-snug text-[#f4f1ea] opacity-0 shadow-[0_12px_28px_-12px_rgba(28,27,25,0.7)] transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    {office.leadDays > 0 ? (
                      <>
                        <span className="flex items-start gap-2">
                          <Landmark aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none opacity-70" />
                          {office.office}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[#f4f1ea]/75">
                          <Clock aria-hidden className="h-3.5 w-3.5 flex-none opacity-70" />
                          About {plural(office.leadDays, "working day")}, offices closed Friday and Saturday
                        </span>
                      </>
                    ) : (
                      <span className="flex items-start gap-2">
                        <Landmark aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none opacity-70" />
                        {counter(office)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 hidden text-right text-[12.5px] italic lg:block [@media(max-height:720px)]:hidden" style={{ color: MUTED }}>
            Point at a clause to see where the paper comes from.
          </p>

          {updated && (
            <span
              key={`stamp-${run}`}
              aria-hidden
              className="hero-stamp code absolute right-4 top-5 rounded-[5px] border-[2.5px] px-3 py-1 text-[14px] outline outline-1 outline-offset-2 sm:right-7 sm:top-7 sm:text-[17px]"
              style={matters ? { color: CRIT, borderColor: CRIT, outlineColor: "rgba(166,58,42,0.45)" } : { color: MUTED, borderColor: MUTED, outlineColor: "rgba(107,101,91,0.4)" }}
            >
              {stamp}
            </span>
          )}
        </article>
      </div>

      {/* What that version does to a folder prepared for the original. */}
      <div className="min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start">
        <div className="rounded-[var(--r-panel)] bg-white/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_24px_60px_-34px_rgba(28,27,25,0.45)] sm:p-7">
          <p className="text-[15px] italic text-ink-3">A folder prepared for the original, under {updated ? versionTag(version) : "the original"}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className={cn("display text-[64px] leading-none transition-colors duration-500", (stale > 0 || added > 0) && "text-crit")}>
              <AnimatedNumber value={summary.percentage} />
              <span className="text-[30px]">%</span>
            </span>
            <span className="text-[17px] text-ink-2">ready</span>
          </p>
          <PaperRow
            key={run}
            className="mt-4"
            size={1.2}
            items={papers.map((i) => ({ id: i.requirement.id, title: i.requirement.title, status: i.readinessStatus }))}
          />
          <ul aria-live="polite" className="mt-4 min-h-[52px] space-y-1 text-[16px] leading-snug">
            {!updated ? (
              <li className="text-ok">Every paper matches the notice.</li>
            ) : stale === 0 && added === 0 ? (
              <li className="text-ok">{matters ? "Nothing you prepared is affected." : "A cosmetic edit. Nothing to redo."}</li>
            ) : (
              <>
                {stale > 0 && (
                  <li className="hero-line flex items-baseline gap-2.5 text-warn">
                    <span aria-hidden className="h-2 w-2 flex-none translate-y-[-1px] rounded-full bg-[#c08a2a]" />
                    {stale === 1 ? "1 paper you prepared no longer matches" : `${stale} papers you prepared no longer match`}
                  </li>
                )}
                {added > 0 && (
                  <li className="hero-line flex items-baseline gap-2.5 text-crit" style={{ animationDelay: "120ms" }}>
                    <span aria-hidden className="h-2 w-2 flex-none translate-y-[-1px] rounded-full bg-crit" />
                    {added === 1 ? "1 new paper is now required" : `${added} new papers are now required`}
                  </li>
                )}
              </>
            )}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="button" onClick={tryIt} className={buttonClass("primary")}>
              Try it on my checklist
            </button>
            <Link href="/my-plan" className="text-[16px] font-semibold underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink">
              Open my plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
