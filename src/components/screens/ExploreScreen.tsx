"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LayoutList, MessageSquareText, Scale, Search, Table2, X } from "lucide-react";
import { PaperRow, VersionTrack } from "@/components/ui/Visuals";
import type { DossierCategory } from "@/domain/types";
import { compareNoticeVersions } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useAllIntelligence, type DossierIntelligence } from "@/hooks/useDossierIntelligence";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CATEGORY_LABEL, FRESHNESS_LABEL, formatDate, isConsequential, plural, shortTitle, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { CoverTile } from "@/components/ui/CoverTile";
import { LedgerDataTable, type LedgerColumn } from "@/components/ui/LedgerDataTable";
import { ActionRowLink, ActionRows, Button, Skel, Stamp } from "@/components/ui/primitives";

type Toggle = "conflict" | "changes" | "community";
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: "conflict", label: "Sources disagree" },
  { id: "changes", label: "Changed since first published" },
  { id: "community", label: "Has field reports" },
];
const CATEGORIES = ["all", "scholarship", "digital_service", "internship", "public_procedure"] as const;

interface DirectoryRow {
  intel: DossierIntelligence;
  hits: string[];
  changes: number;
}

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
  const router = useRouter();
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const [query, setQuery] = useState("");
  const { debouncedValue: debouncedQuery, isPending: isDebouncing } = useDebouncedValue(query, 180);
  const [category, setCategory] = useState<DossierCategory | "all">("all");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const q = debouncedQuery.trim().toLowerCase();

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
        .filter((r): r is DirectoryRow => {
          if (r.hits === null) return false;
          if (toggles.has("conflict") && r.intel.readinessSummary.conflictCount === 0) return false;
          if (toggles.has("changes") && r.changes === 0) return false;
          if (toggles.has("community") && r.intel.readinessSummary.communityReportCount === 0) return false;
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

  const tableColumns = useMemo<LedgerColumn<DirectoryRow>[]>(
    () => [
      {
        id: "title",
        header: "Dossier",
        sortValue: (r) => shortTitle(r.intel.notice),
        cell: (r) => (
          <div>
            <p className="font-semibold text-ink">{shortTitle(r.intel.notice)}</p>
            <p className="mt-0.5 text-[13.5px] text-ink-3">{r.intel.notice.institution}</p>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        sortValue: (r) => CATEGORY_LABEL[r.intel.notice.category],
        cell: (r) => <span className="text-[14px] text-ink-2">{CATEGORY_LABEL[r.intel.notice.category]}</span>,
      },
      {
        id: "version",
        header: "Version",
        sortValue: (r) => r.intel.activeVersion.versionNumber,
        cell: (r) => <Stamp tone="plain">{versionTag(r.intel.activeVersion.versionLabel)}</Stamp>,
      },
      {
        id: "changes",
        header: "Changes",
        align: "right",
        sortValue: (r) => r.changes,
        cell: (r) => (
          <span className={cn("font-medium", r.changes > 0 ? "text-crit" : "text-ink-3")}>
            {r.changes}
          </span>
        ),
      },
      {
        id: "conflicts",
        header: "Conflicts",
        align: "right",
        sortValue: (r) => r.intel.readinessSummary.conflictCount,
        cell: (r) => (
          <span className={cn("font-medium", r.intel.readinessSummary.conflictCount > 0 ? "text-crit" : "text-ink-3")}>
            {r.intel.readinessSummary.conflictCount}
          </span>
        ),
      },
      {
        id: "reports",
        header: "Field reports",
        align: "right",
        sortValue: (r) => r.intel.readinessSummary.communityReportCount,
        cell: (r) => <span className="text-ink-2">{r.intel.readinessSummary.communityReportCount}</span>,
      },
      {
        id: "readiness",
        header: "Readiness",
        align: "right",
        sortValue: (r) => r.intel.readinessSummary.percentage,
        cell: (r) =>
          hydrated ? (
            <span className="font-semibold text-ink">{r.intel.readinessSummary.percentage}%</span>
          ) : (
            <Skel className="ml-auto h-4 w-12" />
          ),
      },
    ],
    [hydrated]
  );

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

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[16px] italic text-ink-3" aria-live="polite">
          {visible.length} of {all.length} dossiers{filtered && " match"}
          {isDebouncing && <span className="ml-2 text-[14px] text-ink-3">· Filtering…</span>}
          {filtered && (
            <button type="button" onClick={clear} className="ml-4 not-italic text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              Clear filters
            </button>
          )}
        </p>

        <div
          role="group"
          aria-label="Directory layout"
          className="inline-flex rounded-[var(--r-control)] bg-paper p-1 shadow-[inset_0_0_0_1px_var(--hair)]"
        >
          <button
            type="button"
            aria-pressed={viewMode === "cards"}
            onClick={() => setViewMode("cards")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-[14px] transition-colors",
              viewMode === "cards" ? "bg-ink font-medium text-ground" : "text-ink-2 hover:text-ink"
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-[14px] transition-colors",
              viewMode === "table" ? "bg-ink font-medium text-ground" : "text-ink-2 hover:text-ink"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Ledger table
          </button>
        </div>
      </div>

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
      ) : viewMode === "table" ? (
        <div className="mt-6">
          <LedgerDataTable
            caption="Sortable directory of NIYOM public dossiers"
            columns={tableColumns}
            rows={visible}
            getRowKey={(r) => r.intel.notice.id}
            defaultSortColumnId="readiness"
            defaultSortDirection="desc"
            onRowClick={(r) => {
              setActiveNotice(r.intel.notice.id);
              router.push(`/notice/${r.intel.notice.id}`);
            }}
          />
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
                  <div className="mt-6 flex items-center gap-6">
                    <VersionTrack notice={notice} showDates={false} className="min-w-0 max-w-[360px] flex-1 text-ink-2" />
                    {hydrated ? (
                      <div className="flex-none">
                        <p className="display num text-[26px] leading-none">{s.percentage}%</p>
                        <PaperRow items={s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES").map((i) => ({ id: i.requirement.id, title: i.requirement.title, status: i.readinessStatus }))} className="mt-1.5" size={0.9} />
                      </div>
                    ) : (
                      <Skel className="h-12 w-20" />
                    )}
                  </div>
                  {(s.conflictCount > 0 || s.communityReportCount > 0) && (
                    <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[15.5px] text-ink-2">
                      {s.conflictCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-crit">
                          <Scale aria-hidden className="h-4 w-4" /> {s.conflictCount === 1 ? "Sources disagree on one rule" : `Sources disagree on ${s.conflictCount} rules`}
                        </span>
                      )}
                      {s.communityReportCount > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquareText aria-hidden className="h-4 w-4" /> {plural(s.communityReportCount, "field report")}
                        </span>
                      )}
                    </p>
                  )}
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
