"use client";

import { useEffect } from "react";
import { Check as CheckIcon, FileText, GitCompareArrows, MessageSquareText, Plus, Scale } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useWatchStore } from "@/hooks/useWatchStore";
import { useDossierIntelligence } from "@/hooks/useDossierIntelligence";
import { chapterOf } from "@/lib/chapters";
import { FRESHNESS_LABEL, REQUIREMENT_GROUPS, formatDate, isConsequential, shortTitle, versionPhrase, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { NoticeObject } from "@/components/ui/NoticeObject";
import { Deadline } from "@/components/ui/Deadline";
import { ActionRowLink, ActionRows, Stamp } from "@/components/ui/primitives";
import { Details, FieldReports } from "@/components/ledger/parts";
import { RequirementEntry } from "@/components/ledger/RequirementEntry";

/** The published versions; choosing one turns the whole page to that snapshot. */
export function VersionList({ noticeId }: { noticeId: string }) {
  const intel = useDossierIntelligence(noticeId);
  const setVersion = useNiyomStore((s) => s.setNoticeActiveVersion);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  if (!intel) return null;
  return (
    <div>
      <p className="px-3 text-[15px] italic text-ink-3">Read a version</p>
      <ul role="radiogroup" aria-label="Version" className="mt-2 space-y-0.5">
        {intel.notice.versions.map((v) => {
          const on = v.versionNumber === intel.notice.activeVersionNumber;
          return (
            <li key={v.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setActiveNotice(noticeId);
                  setVersion(noticeId, v.versionNumber);
                }}
                className={cn(
                  "flex w-full items-baseline gap-3 rounded-[var(--r-control)] px-3 py-2 text-left transition-colors duration-300",
                  on ? "bg-ink/[0.08] text-ink" : "text-ink-3 hover:bg-ink/[0.04] hover:text-ink"
                )}
              >
                <span className="code w-[74px] flex-none text-[15px]">{versionTag(v)}</span>
                <span className={cn("min-w-0 flex-1 truncate text-[16px]", on && "font-semibold")}>{v.versionLabel.split(" ").slice(1).join(" ")}</span>
                <span className="num flex-none text-[14px] italic">{formatDate(v.publishedAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FollowButton({ noticeId }: { noticeId: string }) {
  const unfollowed = useWatchStore((s) => s.unfollowed);
  const toggle = useWatchStore((s) => s.toggleFollow);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const following = !unfollowed.includes(noticeId);
  return (
    <button
      type="button"
      aria-pressed={following}
      disabled={!hydrated}
      onClick={() => toggle(noticeId)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition-colors duration-300",
        following ? "border-ink/15 bg-ink/[0.07] text-ink" : "border-ink/30 text-ink-2 hover:border-ink/60 hover:text-ink"
      )}
    >
      {following ? <CheckIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {following ? "Following" : "Follow changes"}
    </button>
  );
}

export function NoticeScreen({ id }: { id: string }) {
  const intel = useDossierIntelligence(id);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const communityReports = useNiyomStore((s) => s.communityReports);
  const openDrawer = useUiStore((s) => s.openDrawer);

  // Visiting a dossier makes it the active one, so the bar follows you.
  useEffect(() => setActiveNotice(id), [id, setActiveNotice]);
  // Deep links from search (#req-…) once entries exist.
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, []);

  if (!intel) return null;
  const { notice, activeVersion, baselineVersion, readinessSummary: s, versionChanges } = intel;
  const tag = versionTag(activeVersion);
  const baselineTag = versionTag(baselineVersion);
  const groups = REQUIREMENT_GROUPS.map((g) => ({ ...g, items: s.items.filter((i) => i.requirement.category === g.id) })).filter(
    (g) => g.items.length > 0
  );
  const consequential = versionChanges.filter(isConsequential).length;
  const dossierReports = communityReports.filter((r) => r.noticeId === notice.id);

  const layers: [string, number, boolean, typeof FileText][] = [
    ["official requirements", activeVersion.requirements.length, false, FileText],
    [`changes since ${versionPhrase(baselineVersion)}`, consequential, false, GitCompareArrows],
    ["source conflicts", s.conflictCount, s.conflictCount > 0, Scale],
    ["field reports", s.communityReportCount, false, MessageSquareText],
  ];

  return (
    <Page chapter={chapterOf(notice.id)} engrave={tag}>
      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* The book stays pinned while you read, as on a Stripe Press book page; nothing here clips its 3D. */}
        <aside className="lg:sticky lg:top-[calc(var(--bar-h)+24px)] lg:self-start">
          <NoticeObject notice={notice} morph open="view" pinned className="max-w-[300px] lg:max-w-none" />
          <div className="mt-4">
            <VersionList noticeId={notice.id} />
          </div>
        </aside>

        <article className="min-w-0 max-w-[720px]">
          <header data-rail="About this notice">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[16px] italic text-ink-3">{notice.institution}</p>
              <FollowButton noticeId={notice.id} />
            </div>
            <h1 className="display mt-3 text-[40px] sm:text-[52px]">{shortTitle(notice)}</h1>
            <p className="mt-3 text-[20px] italic leading-snug text-ink-2">{notice.title}</p>
            <Deadline notice={notice} className="mt-6" />
            <p className="mt-6 max-w-[64ch] text-[17px] leading-relaxed text-ink-2">{notice.systemCaveat}</p>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 rounded-[var(--r-panel)] bg-ink/[0.04] p-6 sm:grid-cols-4">
              {layers.map(([label, n, alarm, Icon]) => (
                <div key={label} className="flex flex-col">
                  <dt className="mt-1 text-[15px] italic leading-snug text-ink-2">{label}</dt>
                  <dd className={cn("order-first flex items-center gap-2.5", alarm && "text-crit")}>
                    <Icon aria-hidden className="h-5 w-5 opacity-60" />
                    <span className="display num text-[38px] leading-none">{n}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <Details summary={`Where this comes from: ${notice.sources.length} official source${notice.sources.length === 1 ? "" : "s"}`}>
              <ul className="space-y-4">
                {notice.sources.map((src) => (
                  <li key={src.id} className="rounded-[var(--r-card)] bg-ink/[0.035] p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[17px] font-semibold">{src.authority}</p>
                      <Stamp tone={src.freshness === "recently_checked" ? "ok" : "warn"}>{FRESHNESS_LABEL[src.freshness]}</Stamp>
                    </div>
                    <p className="mt-0.5 text-[16px] italic text-ink-2">{src.documentTitle}</p>
                    <p className="num mt-2 text-[14.5px] text-ink-3">
                      Published {formatDate(src.publishedAt)}, reviewed {formatDate(src.lastReviewedAt)}
                    </p>
                    <p className="mt-1 break-all text-[14px] text-ink-3">{src.url}</p>
                  </li>
                ))}
              </ul>
            </Details>
          </header>

          {groups.map((g) => (
            <section key={g.id} data-rail={g.label} aria-labelledby={`group-${g.id}`} className="mt-16 scroll-mt-28">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`group-${g.id}`} className="display text-[30px]">
                  {g.label}
                </h2>
                <span className="text-[15px] italic text-ink-3">
                  {g.items.length} in {tag}
                </span>
              </div>
              <p className="mt-1 text-[16px] italic text-ink-3">{g.blurb}</p>
              <ul className="mt-4">
                {g.items.map((item) => (
                  <RequirementEntry key={item.requirement.id} item={item} notice={notice} activeVersion={activeVersion} hydrated={hydrated} scope="spec" />
                ))}
              </ul>
            </section>
          ))}

          {dossierReports.length > 0 && (
            <section data-rail="Field reports" aria-labelledby="group-reports" className="mt-16 scroll-mt-28">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="group-reports" className="display text-[30px]">
                  Field reports
                </h2>
                <span className="text-[15px] italic text-ink-3">
                  {dossierReports.length} recorded
                </span>
              </div>
              <FieldReports reports={dossierReports} onAdd={() => openDrawer({ noticeId: notice.id })} />
            </section>
          )}

          <ActionRows className="mt-16 max-w-[520px]">
            <ActionRowLink href="/my-plan" label="Open my preparation plan" meta={hydrated ? `${s.percentage}% ready` : undefined} />
            {consequential > 0 && <ActionRowLink href={`/changes/${notice.id}`} label="See what changed" meta={`${baselineTag} to ${tag}`} />}
          </ActionRows>
        </article>
      </div>
    </Page>
  );
}
