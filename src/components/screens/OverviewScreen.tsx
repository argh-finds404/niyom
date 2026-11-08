"use client";

import Link from "next/link";
import { useMemo } from "react";
import { compareNoticeVersions } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAllIntelligence, useDossierIntelligence, type DossierIntelligence } from "@/hooks/useDossierIntelligence";
import { HERO_NOTICE_ID } from "@/hooks/useScenarios";
import { chapterOf } from "@/lib/chapters";
import { CATEGORY_LABEL, formatDate, isConsequential, isCosmetic, plural, shortTitle, versionPhrase, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bleed, Container, Page } from "@/components/ui/Page";
import { NoticeObject } from "@/components/ui/NoticeObject";
import { Deadline } from "@/components/ui/Deadline";
import { scheduleHeadline } from "@/components/ui/PrepSchedule";
import { CorrigendumScene } from "@/components/ui/CorrigendumScene";
import { HeroScene } from "@/components/ui/HeroScene";
import { PaperRow, VersionTrack } from "@/components/ui/Visuals";
import { ActionRowLink, ActionRows, Button, Skel, buttonClass, withViewTransition } from "@/components/ui/primitives";
import { Redline } from "@/components/ledger/parts";

const link = "font-semibold underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink";

/* ───────────── Hero ───────────── */

function Hero() {
  return (
    <Bleed data-rail="Start" className="wash relative">
      {/* The rule's own name, engraved large behind the notice, drifting slower than the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="drift absolute -bottom-[0.2em] -left-[0.04em] select-none font-bengali text-[clamp(150px,30vw,440px)] leading-none text-transparent [-webkit-text-stroke:1.25px_color-mix(in_srgb,var(--ink)_13%,transparent)]">
          নিয়ম
        </span>
      </div>
      <Container className="relative pb-16 pt-6 lg:min-h-[calc(100svh-var(--bar-h))] lg:pb-12 lg:pt-[clamp(20px,calc((100svh-var(--bar-h)-680px)/2),110px)]">
        <HeroScene />
      </Container>
    </Bleed>
  );
}

/* ───────────── Your next steps ───────────── */

/** The applicant's folder at a glance: every required paper, and where each one stands. */
function Folder({ intel }: { intel: DossierIntelligence }) {
  const { notice, readinessSummary: s } = intel;
  const papers = s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES");
  const done = papers.filter((i) => i.readinessStatus === "completed").length;
  return (
    <div className="mt-10 max-w-[440px]">
      <div className="relative">
        {/* A manila folder: the tab, then the pocket the papers sit in. */}
        <span aria-hidden className="absolute -top-[13px] left-6 h-[14px] w-32 rounded-t-[9px] bg-[#d8c294]" />
        <div className="rounded-[14px] bg-[#e0cc9f] p-1.5 shadow-[0_26px_50px_-30px_rgba(28,27,25,0.55)]">
          <div className="rounded-[10px] bg-[#fcfbf8] px-5 pb-4 pt-4 text-[#1c1b19] shadow-[0_1px_0_rgba(28,27,25,0.06)]">
            <p className="flex items-baseline justify-between gap-3 text-[14.5px] italic text-[#6b655b]">
              <span>Your folder</span>
              <span className="num not-italic">
                {done} of {papers.length} ready
              </span>
            </p>
            <ul className="mt-3 space-y-2">
              {papers.map((i) => {
                const st = i.readinessStatus;
                return (
                  <li key={i.requirement.id} className="flex items-baseline gap-3 text-[16px] leading-snug">
                    <span
                      aria-hidden
                      className={cn(
                        "w-4 flex-none text-center font-semibold",
                        st === "completed" ? "text-[#2d6a47]" : st === "needs_reverification" ? "text-[#8a5510]" : "text-[#6b655b]"
                      )}
                    >
                      {st === "completed" ? "✓" : st === "needs_reverification" ? "!" : "○"}
                    </span>
                    <span className={cn("min-w-0 flex-1", st === "completed" && "text-[#47433c]")}>{i.requirement.title}</span>
                    <span className="sr-only">
                      {st === "completed" ? "ready" : st === "needs_reverification" ? "changed under you" : "not prepared yet"}
                    </span>
                    {st === "needs_reverification" && <span className="flex-none text-[13.5px] italic text-[#8a5510]">changed</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      <Deadline notice={notice} compact className="mt-6" />
      <Link href="/my-plan" className={cn(buttonClass("primary"), "mt-6")}>
        Open my plan
      </Link>
    </div>
  );
}

function ActionList({ intel }: { intel: DossierIntelligence }) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const reverify = useNiyomStore((s) => s.reverifyRequirement);
  const openInspector = useUiStore((s) => s.openInspector);
  const toast = useUiStore((s) => s.toast);
  const { notice, activeVersion, readinessSummary: s } = intel;
  const tag = versionTag(activeVersion);
  const stale = s.items.filter((i) => i.readinessStatus === "needs_reverification");
  const conflicts = s.items.filter((i) => i.requirement.conflict);
  const pending = s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES" && i.readinessStatus === "pending");
  const clear = !stale.length && !conflicts.length && !pending.length;

  return (
    <section data-rail="Your next steps" aria-labelledby="action" className="pt-24">
      <Container className="grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
        <div className="min-w-0 lg:sticky lg:top-[calc(var(--bar-h)+40px)] lg:self-start">
          <h2 id="action" className="display text-[34px] sm:text-[40px]">
            Your next steps
          </h2>
          <p className="mt-3 max-w-[36ch] text-[18px] italic leading-snug text-ink-2">
            For {shortTitle(notice)}, as it stands in {versionPhrase(activeVersion)}.
          </p>
          {hydrated && <Folder intel={intel} />}
        </div>
        <div className="min-w-0">
          {!hydrated ? (
            <div className="space-y-4">
              <Skel className="h-6 w-3/4" />
              <Skel className="h-20 w-full" />
            </div>
          ) : clear ? (
            <p className="text-[22px] italic leading-snug">Nothing to do. Every required item that applies to you matches {versionPhrase(activeVersion)}.</p>
          ) : (
            <ol className="divide-y divide-ink/10">
              {stale.map((i) => (
                <li key={i.requirement.id} style={{ viewTransitionName: `act-${i.requirement.id}` }} className="py-6 first:pt-0">
                  <p className="text-[15.5px] italic text-warn">Changed under you</p>
                  <h3 className="mt-1 text-[21px] font-semibold leading-snug">{i.requirement.title}</h3>
                  <Redline className="mt-3" before={i.previouslyVerifiedValue ?? ""} after={i.requirement.value} fromTag="yours" toTag={tag} />
                  {i.evidenceNote && (
                    <p className="mt-2 text-[14.5px] text-ink-2">
                      Your earlier folder memo: <span className="font-medium text-ink">&ldquo;{i.evidenceNote}&rdquo;</span>
                    </p>
                  )}
                  <Button
                    variant="warn"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      withViewTransition(() => reverify(notice.id, i.requirement, activeVersion.versionNumber));
                      toast({ tone: "ok", title: `${i.requirement.title} re-verified`, body: `Your check now holds against ${versionPhrase(activeVersion)}.` });
                    }}
                  >
                    I have the updated document
                  </Button>
                </li>
              ))}
              {conflicts.map((i) => (
                <li key={i.requirement.id} className="py-6 first:pt-0">
                  <p className="text-[15.5px] italic text-crit">Official sources disagree</p>
                  <h3 className="mt-1 text-[21px] font-semibold leading-snug">{i.requirement.title}</h3>
                  <p className="mt-1.5 text-[16.5px] leading-relaxed text-ink-2">
                    The notice and {i.requirement.conflict!.competingAuthority} give different instructions. NIYOM quotes both and suggests a
                    safe course.
                  </p>
                  <button
                    type="button"
                    onClick={() => openInspector({ noticeId: notice.id, requirementId: i.requirement.id })}
                    className={cn("mt-3 text-[16px]", link)}
                  >
                    Compare both sources
                  </button>
                </li>
              ))}
              {pending.length > 0 && (
                <li className="py-6 first:pt-0">
                  <p className="text-[15.5px] italic text-ink-3">Not prepared yet</p>
                  <p className="mt-1 text-[18px] leading-snug">
                    {pending.map((p, i) => (
                      <span key={p.requirement.id}>
                        {i > 0 && (i === pending.length - 1 ? " and " : ", ")}
                        <span className="font-semibold">{p.requirement.title}</span>
                      </span>
                    ))}
                    .
                  </p>
                  <Link href="/my-plan" className={cn("mt-3 inline-block text-[16px]", link)}>
                    Prepare in my plan
                  </Link>
                </li>
              )}
            </ol>
          )}
        </div>
      </Container>
    </section>
  );
}

/* ───────────── When to start ───────────── */

function WhenToStart({ intel }: { intel: DossierIntelligence }) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const head = scheduleHeadline(intel.timeline);
  return (
    <section data-rail="When to start" aria-labelledby="when" className="pt-28">
      <Container className="grid grid-cols-1 gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
        <div className="min-w-0">
          <h2 id="when" className="display text-[34px] sm:text-[40px]">
            When to start
          </h2>
          <p className="mt-3 max-w-[36ch] text-[18px] italic leading-snug text-ink-2">
            Papers take days at the counters that issue them, and offices close on Friday and Saturday.
          </p>
        </div>
        <div className="min-w-0">
          {hydrated ? (
            <>
              <p className={cn("display text-[30px] leading-tight sm:text-[36px]", head.tone === "crit" ? "text-crit" : head.tone === "warn" ? "text-warn" : "")}>
                {head.title}
              </p>
              <p className="mt-3 text-[18px] leading-relaxed text-ink-2">{head.body}</p>
            </>
          ) : (
            <div aria-busy className="space-y-3">
              <Skel className="h-9 w-64" />
              <Skel className="h-16 w-full" />
            </div>
          )}
          <Link href="/my-plan" className={cn("mt-5 inline-block text-[16px]", link)}>
            See the order of visits in my plan
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* ───────────── The noise filter ───────────── */

function NoiseFilter() {
  const intel = useDossierIntelligence(HERO_NOTICE_ID);
  const records = useNiyomStore((s) => s.readinessRecords);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setVersion = useNiyomStore((s) => s.setNoticeActiveVersion);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);

  const rows = useMemo(() => {
    if (!intel) return [];
    const { notice } = intel;
    const mine = records.filter((r) => r.noticeId === notice.id && r.checked);
    return notice.versions.map((v, i) => {
      const prev = i > 0 ? notice.versions[i - 1] : null;
      const changes = prev ? compareNoticeVersions(prev, v) : [];
      const prevValue = new Map(prev?.requirements.map((r) => [r.id, r.value]));
      const invalidates = prev
        ? mine.filter((rec) => {
            const now = v.requirements.find((r) => r.id === rec.requirementId);
            return now && rec.verifiedAgainstValue === prevValue.get(rec.requirementId) && now.value !== rec.verifiedAgainstValue;
          }).length
        : 0;
      return { v, prev, consequential: changes.filter(isConsequential).length, cosmetic: changes.filter(isCosmetic).length, invalidates };
    });
  }, [intel, records]);

  if (!intel) return null;

  return (
    <section data-rail="Which changes matter" aria-labelledby="noise" className="pt-32">
      <Container>
        <div className="grid grid-cols-1 gap-x-16 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
          <h2 id="noise" className="display text-[34px] sm:text-[40px]">
            Not every change is news
          </h2>
          <p className="text-[18px] leading-relaxed text-ink-2 lg:pt-2">
            The Merit Grant circular was revised twice. One revision only moved a helpdesk room. The other changed what you must submit.
            NIYOM tells them apart, so only the second touches your checklist.
          </p>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {rows.map(({ v, prev, consequential, cosmetic, invalidates }) => {
            const active = v.versionNumber === intel.notice.activeVersionNumber;
            return (
              <li
                key={v.id}
                className={cn(
                  "flex min-w-0 flex-col rounded-[var(--r-panel)] p-6 transition-[background-color,box-shadow] duration-500",
                  active ? "bg-white/70 shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_24px_50px_-34px_rgba(28,27,25,0.5)]" : "bg-ink/[0.035]"
                )}
              >
                <p className="flex items-baseline justify-between gap-4">
                  <span className="display num text-[44px] leading-none">{versionTag(v)}</span>
                  {active && <span className="text-[15px] italic text-ink-2">Your checklist follows this</span>}
                </p>
                <p className="num mt-2 text-[15.5px] italic text-ink-3">{formatDate(v.publishedAt)}</p>
                <p className="mt-5 text-[18px] font-semibold">{v.versionLabel.split(" ").slice(1).join(" ")}</p>
                <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">{v.changeSummary}</p>
                <p className={cn("mt-4 text-[16px] italic leading-snug", !prev || consequential === 0 ? "text-ink-3" : "text-crit")}>
                  {!prev
                    ? `The original. ${plural(v.requirements.length, "requirement")}.`
                    : consequential === 0
                      ? "Cosmetic only, so your checklist is untouched."
                      : `${plural(consequential, "change")} that matter${consequential === 1 ? "s" : ""}${cosmetic ? `, ${cosmetic} cosmetic ignored` : ""}.`}
                  {hydrated && invalidates > 0 && <span className="block text-warn">Invalidates {invalidates} of your checks.</span>}
                </p>
                <p className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-6 text-[16px]">
                  {!active && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNotice(intel.notice.id);
                        setVersion(intel.notice.id, v.versionNumber);
                      }}
                      className={link}
                    >
                      Follow this version
                    </button>
                  )}
                  {prev && (
                    <Link href={`/changes/${intel.notice.id}?from=${prev.versionNumber}&to=${v.versionNumber}`} className={link}>
                      See the redline
                    </Link>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

/* ───────────── Chapters: one colour world per dossier ───────────── */

function Chapters() {
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);

  return (
    <div className="mt-36">
      {all.map(({ notice, activeVersion, readinessSummary: s }) => {
        const first = notice.versions[0];
        const last = notice.versions[notice.versions.length - 1];
        const changes = notice.versions.length > 1 ? compareNoticeVersions(first, last).filter(isConsequential).length : 0;
        return (
          <Bleed
            key={notice.id}
            id={`chapter-${notice.id}`}
            data-cover={chapterOf(notice.id)}
            data-rail={shortTitle(notice)}
            aria-labelledby={`title-${notice.id}`}
            className="relative scroll-mt-[var(--bar-h)] py-24 lg:py-32"
          >
            {/* The version this chapter is on, engraved behind it. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="drift-view absolute right-[5%] top-[7%] select-none whitespace-nowrap text-[clamp(72px,13vw,200px)] font-semibold italic leading-none tracking-[-0.04em] text-transparent [-webkit-text-stroke:1.25px_color-mix(in_srgb,var(--ink)_16%,transparent)]">
                {versionTag(activeVersion)}
              </span>
            </div>
            <Container className="relative grid grid-cols-1 items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
              <Link href={`/notice/${notice.id}`} onClick={() => setActiveNotice(notice.id)} aria-label={`Open ${shortTitle(notice)}`} className="block min-w-0">
                <NoticeObject notice={notice} morph open="view" className="max-w-[540px]" />
              </Link>
              <div className="min-w-0">
                <p className="text-[16px] italic text-ink-2">{CATEGORY_LABEL[notice.category]}</p>
                <h2 id={`title-${notice.id}`} className="display mt-2 text-[38px] sm:text-[46px]">
                  {shortTitle(notice)}
                </h2>
                <p className="mt-3 text-[18px] italic leading-snug text-ink-2">{notice.title}</p>
                <p className="mt-7 text-[17px] leading-relaxed text-ink-2">{activeVersion.changeSummary}</p>
                <div className="mt-8 flex items-center gap-8">
                  <VersionTrack notice={notice} className="min-w-0 flex-1" />
                  {hydrated ? (
                    <div className="flex-none text-right">
                      <p className="display num text-[34px] leading-none">{s.percentage}%</p>
                      <PaperRow items={s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES").map((i) => ({ id: i.requirement.id, title: i.requirement.title, status: i.readinessStatus }))} className="mt-2 justify-end" />
                    </div>
                  ) : (
                    <Skel className="h-14 w-24" />
                  )}
                </div>
                <ActionRows className="mt-9">
                  <ActionRowLink
                    href={`/notice/${notice.id}`}
                    onClick={() => setActiveNotice(notice.id)}
                    label="Read the requirements"
                    meta={versionTag(activeVersion)}
                  />
                  {changes > 0 && (
                    <ActionRowLink
                      href={`/changes/${notice.id}`}
                      onClick={() => setActiveNotice(notice.id)}
                      label="See what changed"
                      meta={`${changes} that matter`}
                    />
                  )}
                  <ActionRowLink
                    href="/my-plan"
                    onClick={() => setActiveNotice(notice.id)}
                    label="Prepare"
                    meta={hydrated ? `${s.percentage}% ready` : undefined}
                  />
                </ActionRows>
              </div>
            </Container>
          </Bleed>
        );
      })}
    </div>
  );
}

export function OverviewScreen() {
  const intel = useDossierIntelligence();
  if (!intel) return null;
  return (
    <Page bleed>
      <Hero />
      <CorrigendumScene />
      <ActionList intel={intel} />
      <WhenToStart intel={intel} />
      <NoiseFilter />
      <Chapters />
    </Page>
  );
}
