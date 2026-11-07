"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { compareNoticeVersions } from "@/domain";
import type { ImpactLevel, RequirementChange } from "@/domain/types";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useWatchStore } from "@/hooks/useWatchStore";
import { useDossierIntelligence, versionOf } from "@/hooks/useDossierIntelligence";
import { chapterOf } from "@/lib/chapters";
import { dayDelta, formatDate, isConsequential, isCosmetic, shortTitle, versionTag } from "@/lib/format";
import { wordDiff } from "@/lib/wordDiff";
import { cn } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { ActionRowLink, ActionRows, Button, Skel, Stamp, withViewTransition, type Tone } from "@/components/ui/primitives";
import { RedlineText } from "@/components/ledger/parts";

type Filter = "matter" | "all" | "cosmetic";
const IMPACT_RANK: Record<ImpactLevel, number> = { critical: 0, "action-needed": 1, informational: 2 };

function impactOf(c: RequirementChange): { tone: Tone; label: string } {
  if (c.impact === "critical") return { tone: "crit", label: "Critical" };
  if (c.impact === "action-needed") return { tone: "warn", label: "Action needed" };
  return { tone: "plain", label: "Cosmetic, ignored" };
}

function presetLabel(i: number, j: number, total: number, changes: RequirementChange[]) {
  if (i === 0 && j === total - 1 && total > 2) return "Everything, start to finish";
  if (i === 0 && j === total - 1) return "Everything that changed";
  if (!changes.some(isConsequential)) return "Cosmetic only";
  return "The latest revision";
}

/* ───────────── One change, as a before/after card ───────────── */

function ChangeCard({ change, fromTag, toTag, toIsActive, noticeId }: { change: RequirementChange; fromTag: string; toTag: string; toIsActive: boolean; noticeId: string }) {
  const intel = useDossierIntelligence(noticeId);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const reverify = useNiyomStore((s) => s.reverifyRequirement);
  const openInspector = useUiStore((s) => s.openInspector);
  const toast = useUiStore((s) => s.toast);
  const { previous: prev, current: curr } = change;
  const tokens = prev && curr ? wordDiff(prev.value, curr.value) : null;
  const delta = change.category === "deadline" ? dayDelta(prev?.value, curr?.value) : null;
  const impact = impactOf(change);
  const item = intel?.readinessSummary.items.find((i) => i.requirement.id === change.requirementId);
  const sameWords = prev && curr && prev.value === curr.value;
  const stale = toIsActive && hydrated && item?.readinessStatus === "needs_reverification";

  return (
    <li
      id={`chg-${change.requirementId}`}
      data-rail={change.title}
      style={{ viewTransitionName: `chg-${change.requirementId}` }}
      className="scroll-mt-[calc(var(--bar-h)+24px)] overflow-hidden rounded-[var(--r-panel)] bg-white/55 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_9%,transparent),0_1px_2px_rgba(28,27,25,0.04)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div className="min-w-0">
          <h3 className="text-[21px] font-semibold leading-snug tracking-[-0.01em]">{change.title}</h3>
          <p className="mt-0.5 text-[14.5px] text-ink-3">
            <span className="code">{change.code}</span>, {change.type === "added" ? "new" : change.type}
          </p>
        </div>
        <Stamp tone={impact.tone}>{impact.label}</Stamp>
      </div>

      {sameWords && (
        <p className="mx-6 mt-3 text-[16px] italic text-crit">
          {!prev.conflict && curr.conflict
            ? `Same wording, but ${curr.conflict.competingAuthority} now gives a contradicting instruction.`
            : prev.mandatory !== curr.mandatory
              ? "Same wording; whether it is required changed."
              : "Same wording; its review state changed."}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2">
        <div className="min-w-0 break-words bg-ink/[0.035] px-6 py-5">
          <p className="text-[14.5px] italic text-ink-3">Before, {fromTag}</p>
          {prev ? (
            <>
              <p className="mt-1.5 text-[16.5px] leading-relaxed text-ink-2">{tokens ? <RedlineText tokens={tokens} side="before" /> : prev.value}</p>
              <p className="mt-2 text-[14px] text-ink-3">{prev.mandatory ? "Required" : "Optional"}</p>
            </>
          ) : (
            <p className="mt-1.5 text-[16.5px] italic text-ink-3">Not in {fromTag}.</p>
          )}
        </div>
        <div className="min-w-0 break-words px-6 py-5">
          <p className="text-[14.5px] italic text-ink-3">After, {toTag}</p>
          {curr ? (
            <>
              <p className="mt-1.5 text-[16.5px] leading-relaxed">{tokens ? <RedlineText tokens={tokens} side="after" /> : curr.value}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink-3">
                <span className={cn(prev && !prev.mandatory && curr.mandatory && "font-semibold text-crit")}>{curr.mandatory ? "Required" : "Optional"}</span>
                {delta !== null && delta !== 0 && (
                  <Stamp tone={delta > 0 ? "warn" : "crit"}>
                    {delta > 0 ? "+" : "−"}
                    {Math.abs(delta)} days
                  </Stamp>
                )}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[16.5px] italic text-crit">Removed in {toTag}.</p>
          )}
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center justify-between gap-4 px-6 py-4", stale ? "bg-warn/[0.09]" : "border-t border-ink/8")}>
        <p className="max-w-[56ch] text-[15.5px] leading-snug text-ink-2">
          {stale ? (
            <span className="text-warn">This invalidates what you prepared. </span>
          ) : null}
          {change.applicantActionRequired}
        </p>
        {stale && item ? (
          <Button
            variant="warn"
            size="sm"
            onClick={() => {
              withViewTransition(() => reverify(noticeId, item.requirement, intel!.activeVersion.versionNumber));
              toast({ tone: "ok", title: `${change.title} re-verified`, body: `Your check now holds against ${toTag}.` });
            }}
          >
            I have the updated document
          </Button>
        ) : item ? (
          <button
            type="button"
            onClick={() => openInspector({ noticeId, requirementId: change.requirementId })}
            className="tap text-[15px] italic text-ink-2 underline decoration-ink/25 underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            {!hydrated ? <Skel className="h-4 w-24" /> : item.readinessStatus === "completed" ? `You checked this against ${toTag}` : "Details"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/* ───────────── Screen ───────────── */

export function ChangesScreen({ id }: { id: string }) {
  const intel = useDossierIntelligence(id);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const setVersion = useNiyomStore((s) => s.setNoticeActiveVersion);
  const markSeen = useWatchStore((s) => s.markSeen);
  const notice = intel?.notice;
  const versions = useMemo(() => notice?.versions ?? [], [notice]);
  const first = versions[0]?.versionNumber ?? 1;
  const last = versions[versions.length - 1]?.versionNumber ?? 1;
  const active = notice?.activeVersionNumber ?? last;
  const defaultTo = active > first ? active : last;

  const [pair, setPair] = useState<[number, number]>(() => [first, defaultTo]);
  const [lastId, setLastId] = useState(id);
  const [filter, setFilter] = useState<Filter>("matter");

  if (id !== lastId) {
    setLastId(id);
    setPair([first, defaultTo]);
  }

  useEffect(() => setActiveNotice(id), [id, setActiveNotice]);
  // Opening the redline is reviewing it: clear the alert for the version your checklist follows.
  useEffect(() => {
    if (hydrated) markSeen(id, active);
  }, [hydrated, id, active, markSeen]);
  useEffect(() => {
    // Deep links: /changes/:id?from=2&to=3
    const q = new URLSearchParams(location.search);
    const f = Number(q.get("from"));
    const t = Number(q.get("to"));
    const valid = (n: number) => versions.some((v) => v.versionNumber === n);
    if (valid(f) && valid(t) && f < t) {
      const raf = requestAnimationFrame(() => setPair([f, t]));
      return () => cancelAnimationFrame(raf);
    }
  }, [versions]);

  const validFrom = versions.some((v) => v.versionNumber === pair[0]) ? pair[0] : first;
  const validTo = versions.some((v) => v.versionNumber === pair[1]) && pair[1] > validFrom ? pair[1] : defaultTo;
  const from = validFrom;
  const to = validTo;

  const fromV = notice ? versionOf(notice, from) : null;
  const toV = notice ? versionOf(notice, to) : null;

  const changes = useMemo(() => {
    if (!fromV || !toV || from >= to) return [];
    return compareNoticeVersions(fromV, toV).sort(
      (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || a.code.localeCompare(b.code)
    );
  }, [fromV, toV, from, to]);

  if (!intel || !notice || !fromV || !toV) return null;

  const fromTag = versionTag(fromV.versionLabel);
  const toTag = versionTag(toV.versionLabel);
  const changed = changes.filter((c) => c.type !== "unchanged");
  const matter = changed.filter(isConsequential);
  const cosmetic = changed.filter(isCosmetic);
  const unchanged = changes.filter((c) => c.type === "unchanged");
  const shown = filter === "matter" ? matter : filter === "cosmetic" ? cosmetic : changed;
  const presets = versions.flatMap((a, i) =>
    versions.slice(i + 1).map((b, k) => ({
      from: a.versionNumber,
      to: b.versionNumber,
      label: presetLabel(i, i + 1 + k, versions.length, compareNoticeVersions(a, b)),
    }))
  );
  const toIsActive = to === notice.activeVersionNumber;
  const choose = (p: [number, number]) => withViewTransition(() => setPair(p));

  return (
    <Page chapter={chapterOf(notice.id)}>
      <header data-rail="Summary" className="max-w-[820px]">
        <p className="text-[16px] italic text-ink-3">{notice.institution}</p>
        <h1 className="display mt-3 text-[38px] sm:text-[52px]">What changed in {shortTitle(notice)}</h1>
        <p className="mt-4 text-[20px] italic leading-snug text-ink-2">
          {fromTag}, {formatDate(fromV.publishedAt)}, to {toTag}, {formatDate(toV.publishedAt)}
        </p>

        {versions.length > 2 && (
          <div role="radiogroup" aria-label="Compare" className="mt-8 flex flex-wrap gap-2">
            {presets.map((p) => {
              const on = p.from === from && p.to === to;
              return (
                <button
                  key={`${p.from}-${p.to}`}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose([p.from, p.to])}
                  className={cn(
                    "flex flex-col items-start rounded-[var(--r-card)] px-4 py-2.5 text-left transition-colors duration-300",
                    on ? "bg-ink text-ground" : "bg-ink/[0.05] hover:bg-ink/[0.09]"
                  )}
                >
                  <span className="code flex items-center gap-1.5 text-[16px]">
                    {versionTag(versionOf(notice, p.from).versionLabel)} <ArrowRight className="h-3.5 w-3.5" />{" "}
                    {versionTag(versionOf(notice, p.to).versionLabel)}
                  </span>
                  <span className={cn("text-[14.5px] italic", on ? "opacity-80" : "text-ink-3")}>{p.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-[24px] leading-snug sm:text-[28px]">
          <span className={cn("display", matter.length && "text-crit")}>{matter.length}</span> change{matter.length === 1 ? "" : "s"} that matter
          {cosmetic.length > 0 && (
            <span className="text-ink-3">
              , <span className="display">{cosmetic.length}</span> cosmetic edit{cosmetic.length === 1 ? "" : "s"} ignored
            </span>
          )}
          <span className="text-ink-3">
            , <span className="display">{unchanged.length}</span> unchanged.
          </span>
        </p>
        {!toIsActive && (
          <p className="mt-4 flex flex-wrap items-center gap-3 text-[16px] italic text-ink-2">
            Your checklist follows {versionTag(intel.activeVersion.versionLabel)}.
            <Button size="sm" onClick={() => setVersion(notice.id, to)}>
              Follow {toTag} instead
            </Button>
          </p>
        )}
      </header>

      <section aria-label="Changes" className="mt-12 max-w-[880px]">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1">
          {(
            [
              ["matter", "Changes that matter", matter.length],
              ["cosmetic", "Cosmetic", cosmetic.length],
              ["all", "All changes", changed.length],
            ] as [Filter, string, number][]
          ).map(([f, label, n]) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => withViewTransition(() => setFilter(f))}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full px-4 text-[16px] transition-colors duration-300",
                filter === f ? "bg-ink/[0.09] text-ink" : "text-ink-3 hover:bg-ink/[0.04] hover:text-ink"
              )}
            >
              {label}
              <span className="num text-[14px] text-ink-3">{n}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-8 rounded-[var(--r-panel)] bg-ink/[0.035] px-6 py-12 text-center text-[19px] italic text-ink-3">
            {filter === "cosmetic" ? "No cosmetic edits" : "Nothing that matters changed"} between {fromTag} and {toTag}.
          </p>
        ) : (
          <ul className="mt-6 space-y-5">
            {shown.map((c) => (
              <ChangeCard key={c.requirementId} change={c} fromTag={fromTag} toTag={toTag} toIsActive={toIsActive} noticeId={notice.id} />
            ))}
          </ul>
        )}

        {unchanged.length > 0 && (
          <p className="mt-8 text-[16px] leading-relaxed text-ink-3">
            <span className="italic">Unchanged: </span>
            {unchanged.map((c) => c.title).join(", ")}.
          </p>
        )}

        <ActionRows className="mt-14 max-w-[520px]">
          <ActionRowLink href="/my-plan" label="Open my preparation plan" />
          <ActionRowLink href={`/notice/${notice.id}`} label="Read all requirements" meta={versionTag(intel.activeVersion.versionLabel)} />
        </ActionRows>
      </section>
    </Page>
  );
}
