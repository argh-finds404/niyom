"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { DossierCategory } from "@/domain/types";
import { compareNoticeVersions } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useAllIntelligence, type DossierIntelligence } from "@/hooks/useDossierIntelligence";
import { CATEGORY_LABEL, FRESHNESS_LABEL, formatDate, isConsequential, plural, shortTitle, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { CoverTile } from "@/components/ui/CoverTile";
import { ActionRowLink, ActionRows, Button, Skel, Stamp } from "@/components/ui/primitives";

type Toggle = "conflict" | "changes" | "community";
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: "conflict", label: "Sources disagree" },
  { id: "changes", label: "Changed since first published" },
  { id: "community", label: "Has field reports" },
];
const CATEGORIES = ["all", "scholarship", "digital_service", "internship", "public_procedure"] as const;

function matches(intel: DossierIntelligence, q: string): string[] | null {
  if (!q) return [];
  const { notice } = intel;
  const hay = `${notice.title} ${notice.institution} ${notice.departmentOrTrust} ${notice.zone} ${notice.sources
    .map((s) => `${s.authority} ${s.documentTitle}`)
    .join(" ")}`.toLowerCase();
  const reqHits = new Map<string, string>();
  notice.versions.forEach((v) =>
    v.requirements.forEach((r) => {
      if (`${r.code} ${r.title} ${r.value}`.toLowerCase().includes(q)) reqHits.set(r.code, `${r.code} ${r.title}`);
    })
  );
  if (hay.includes(q) || reqHits.size) return [...reqHits.values()];
  return null;
}

export function ExploreScreen() {
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DossierCategory | "all">("all");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const q = query.trim().toLowerCase();

  const rows = useMemo(
    () =>
      all
        .map((intel) => {
          const { versions } = intel.notice;
          // Whole published history (first → latest), independent of which version is being inspected.
          const changes =
            versions.length > 1 ? compareNoticeVersions(versions[0], versions[versions.length - 1]).filter(isConsequential).length : 0;
          return { intel, hits: matches(intel, q), changes };
        })
        .filter(({ intel, hits, changes }) => {
          if (hits === null) return false;
          if (toggles.has("conflict") && intel.readinessSummary.conflictCount === 0) return false;
          if (toggles.has("changes") && changes === 0) return false;
          if (toggles.has("community") && intel.readinessSummary.communityReportCount === 0) return false;
          return true;
        }),
    [all, q, toggles]
  );

  const visible = rows.filter((r) => category === "all" || r.intel.notice.category === category);
  const countFor = (c: DossierCategory | "all") => rows.filter((r) => c === "all" || r.intel.notice.category === c).length;
  const filtered = Boolean(q) || toggles.size > 0 || category !== "all";
  const clear = () => {
    setQuery("");
    setCategory("all");
    setToggles(new Set());
  };

  return (
    <Page>
      <header data-rail="Search" className="max-w-[760px]">
        <h1 className="display text-[44px] sm:text-[56px]">Directory</h1>
        <p className="mt-4 text-[22px] italic leading-snug text-ink-2">
          Every notice and public procedure NIYOM keeps a ledger for.
        </p>
      </header>

      <label className="relative mt-10 flex items-center rounded-[var(--r-panel)] bg-white/60 px-5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent)] transition-shadow focus-within:shadow-[0_0_0_2px_var(--ink)]">
        <span className="sr-only">Search notices, institutions and requirement codes</span>
        <Search className="pointer-events-none absolute left-5 h-5 w-5 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a title, an institution, or a code like REQ-DOC-01"
          className="h-16 w-full bg-transparent pl-9 pr-10 text-[20px] outline-none placeholder:italic placeholder:text-ink-3 focus-visible:outline-none sm:text-[22px] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 grid h-10 w-10 place-items-center rounded-full text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </label>

      <div className="mt-6 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div role="tablist" aria-label="Category" className="scroll-x -mx-1 flex gap-1 px-1 sm:flex-wrap">
          {CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <button
                key={c}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setCategory(c)}
                className={cn(
                  "group relative flex h-10 flex-none items-center gap-1.5 rounded-[var(--r-control)] px-3 text-[16.5px] transition-colors duration-300",
                  on ? "bg-ink/[0.08] text-ink" : "text-ink-3 hover:bg-ink/[0.04] hover:text-ink"
                )}
              >
                {c === "all" ? "All" : CATEGORY_LABEL[c]}
                <span className="num text-[14px] text-ink-3">{countFor(c)}</span>
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Filters" className="flex flex-wrap gap-x-6 gap-y-1 px-1">
          {TOGGLES.map((t) => {
            const on = toggles.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setToggles((prev) => {
                    const next = new Set(prev);
                    if (on) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }
                className="flex h-9 items-center gap-2.5 text-[16px] text-ink-2 transition-colors hover:text-ink"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] transition-colors duration-200",
                    on ? "border-ink bg-ink" : "border-ink/50"
                  )}
                >
                  {on && <span className="h-1.5 w-1.5 rounded-[2px] bg-ground" />}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-10 text-[16px] italic text-ink-3" aria-live="polite">
        {visible.length} of {all.length} dossiers{filtered && " match"}
        {filtered && (
          <button type="button" onClick={clear} className="ml-4 not-italic text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            Clear filters
          </button>
        )}
      </p>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-[var(--r-panel)] bg-ink/[0.035] py-20 text-center">
          <p className="text-[24px] italic">Nothing in the ledger matches.</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[17px] text-ink-2">
            {q
              ? `No title, authority or requirement contains “${query}”${toggles.size ? " with these filters" : ""}.`
              : "No dossier has every property you selected."}
          </p>
          <Button className="mt-8" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="mt-4">
          {visible.map(({ intel, hits, changes }) => {
            const { notice, activeVersion, readinessSummary: s } = intel;
            const freshest = notice.sources.reduce((a, b) => (a.lastReviewedAt > b.lastReviewedAt ? a : b));
            const tag = versionTag(activeVersion.versionLabel);
            return (
              <li
                key={notice.id}
                data-rail={shortTitle(notice)}
                className="grid grid-cols-1 gap-x-12 gap-y-6 border-t border-ink/10 py-12 md:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[170px_minmax(0,1fr)_280px]"
              >
                <Link
                  href={`/notice/${notice.id}`}
                  onClick={() => setActiveNotice(notice.id)}
                  className="group block w-[130px] md:w-auto"
                  aria-label={`Open ${notice.title}`}
                >
                  <CoverTile
                    noticeId={notice.id}
                    category={notice.category}
                    title={shortTitle(notice)}
                    top={tag}
                    className="aspect-[3/4] w-full group-hover:-translate-y-1.5"
                  />
                </Link>
                <div className="min-w-0">
                  <p className="text-[15.5px] italic text-ink-3">
                    {CATEGORY_LABEL[notice.category]} · {notice.zone}
                  </p>
                  <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
                    <Link href={`/notice/${notice.id}`} onClick={() => setActiveNotice(notice.id)} className="tap hover:underline hover:decoration-1 hover:underline-offset-4">
                      {shortTitle(notice)}
                    </Link>
                  </h2>
                  <p className="mt-2 text-[18px] italic leading-snug text-ink-2">{notice.title}</p>
                  <p className="mt-1.5 text-[16px] text-ink-3">
                    {notice.institution} · {notice.departmentOrTrust}
                  </p>
                  <p className="mt-4 max-w-[64ch] text-[16.5px] leading-relaxed text-ink-2">{notice.systemCaveat}</p>
                  {hits && hits.length > 0 && (
                    <p className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-[15px] italic text-ink-3">Matched</span>
                      {hits.slice(0, 4).map((h) => (
                        <Stamp key={h} tone="warn" className="[font-variant-caps:normal] tracking-normal">
                          {h}
                        </Stamp>
                      ))}
                    </p>
                  )}
                  <p className="num mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[16px] text-ink-2">
                    <span>{plural(notice.versions.length, "version")}</span>
                    <span className={cn(changes && "text-crit")}>{plural(changes, "consequential change")}</span>
                    <span className={cn(s.conflictCount && "text-crit")}>{plural(s.conflictCount, "source conflict")}</span>
                    <span>{plural(s.communityReportCount, "field report")}</span>
                    <span className="text-ink">
                      {hydrated ? `${s.percentage}% ready` : <Skel className="h-4 w-16" />}
                    </span>
                  </p>
                  <p className="mt-2 text-[14.5px] italic text-ink-3">
                    {FRESHNESS_LABEL[freshest.freshness]}, <span className="num">{formatDate(freshest.lastReviewedAt)}</span>
                  </p>
                </div>
                <ActionRows className="md:col-start-2 lg:col-start-auto lg:self-start">
                  <ActionRowLink href={`/notice/${notice.id}`} onClick={() => setActiveNotice(notice.id)} label="Specification" meta={tag} />
                  <ActionRowLink href={`/changes/${notice.id}`} onClick={() => setActiveNotice(notice.id)} label="Changes" meta={changes ? String(changes) : undefined} />
                  <ActionRowLink href="/my-plan" onClick={() => setActiveNotice(notice.id)} label="My plan" />
                </ActionRows>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
