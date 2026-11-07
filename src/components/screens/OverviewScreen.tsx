"use client";

import Link from "next/link";
import { useMemo } from "react";
import { compareNoticeVersions } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAllIntelligence, useDossierIntelligence, type DossierIntelligence } from "@/hooks/useDossierIntelligence";
import { HERO_NOTICE_ID, useScenarios } from "@/hooks/useScenarios";
import { chapterOf } from "@/lib/chapters";
import { CATEGORY_LABEL, formatDate, isConsequential, isCosmetic, plural, shortTitle, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bleed, Container, Page } from "@/components/ui/Page";
import { NoticeObject } from "@/components/ui/NoticeObject";
import { Deadline } from "@/components/ui/Deadline";
import { ActionRowLink, ActionRows, AnimatedNumber, Button, Meter, Skel, buttonClass, withViewTransition } from "@/components/ui/primitives";
import { Redline } from "@/components/ledger/parts";

const link = "font-semibold underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink";

/* ───────────── Hero ───────────── */

function StatusCard({ intel }: { intel: DossierIntelligence }) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const stage = useNiyomStore((s) => s.demoScenarioStage);
  const scenarios = useScenarios();
  const { notice, activeVersion, readinessSummary: s } = intel;
  const tag = versionTag(activeVersion.versionLabel);
  const canSimulate = notice.id === HERO_NOTICE_ID && stage !== "v2_updated" && notice.activeVersionNumber < 3;

  return (
    <div className="mt-10 rounded-[var(--r-panel)] bg-white/55 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_24px_60px_-34px_rgba(28,27,25,0.45)] sm:p-7">
      <div className="flex items-center gap-3">
        <span data-cover={chapterOf(notice.id)} className="h-9 w-7 flex-none rounded-[5px]" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-[16.5px] font-semibold leading-tight">{shortTitle(notice)}</p>
          <p className="text-[14.5px] italic text-ink-3">
            Checked against {tag}, published {formatDate(activeVersion.publishedAt)}
          </p>
        </div>
      </div>

      <p className="mt-5 flex items-baseline gap-3">
        <span className="display text-[60px] leading-none">
          {hydrated ? <AnimatedNumber value={s.percentage} /> : <Skel className="h-12 w-24" />}
          <span className="text-[30px]">%</span>
        </span>
        <span className="text-[17px] text-ink-2">ready</span>
      </p>
      <Meter value={hydrated ? s.percentage : 0} className="mt-4" />
      <p className="num mt-2.5 text-[15.5px] text-ink-2">
        {hydrated ? `${s.completedMandatoryCount} of ${s.totalApplicableMandatoryCount} required items checked` : <Skel className="h-4 w-48" />}
      </p>

      {hydrated && (s.staleReverificationCount > 0 || s.conflictCount > 0) && (
        <ul className="mt-5 space-y-1.5 text-[16px]">
          {s.staleReverificationCount > 0 && (
            <li className="flex items-baseline gap-2.5 text-warn">
              <span aria-hidden className="h-2 w-2 flex-none translate-y-[-1px] rounded-full bg-[#c08a2a]" />
              {plural(s.staleReverificationCount, "check")} changed under you
            </li>
          )}
          {s.conflictCount > 0 && (
            <li className="flex items-baseline gap-2.5 text-crit">
              <span aria-hidden className="h-2 w-2 flex-none translate-y-[-1px] rounded-full bg-crit" />
              {s.conflictCount === 1 ? "One rule where official sources disagree" : `${s.conflictCount} rules where official sources disagree`}
            </li>
          )}
        </ul>
      )}
      <Deadline notice={notice} compact className="mt-5" />

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link href="/my-plan" className={buttonClass("primary")}>
          {hydrated && s.staleReverificationCount ? "Re-verify in my plan" : "Open my plan"}
        </Link>
        {canSimulate && (
          <button type="button" onClick={scenarios.simulateCorrigendum} className={cn("text-[16px] italic", link)}>
            Watch a corrigendum arrive
          </button>
        )}
      </div>
    </div>
  );
}

function Hero({ intel }: { intel: DossierIntelligence }) {
  return (
    <Bleed data-rail="Start" className="wash">
      <Container className="grid grid-cols-1 items-center gap-x-14 gap-y-6 pb-20 pt-8 lg:min-h-[calc(100svh-var(--bar-h))] lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:pb-24 lg:pt-6">
        <figure className="order-2 min-w-0 lg:order-1">
          <NoticeObject notice={intel.notice} float className="max-w-[540px]" />
          <figcaption className="mt-3 text-center text-[15px] italic text-ink-3">
            {shortTitle(intel.notice)} as published: {intel.notice.versions.map((v) => versionTag(v.versionLabel)).join(", ")}
          </figcaption>
        </figure>
        <div className="order-1 min-w-0 lg:order-2">
          <h1 className="display text-[44px] sm:text-[58px]">Be ready. Not just informed.</h1>
          <p className="mt-5 text-[21px] italic leading-snug text-ink-2 sm:text-[23px]">
            Notices change quietly. NIYOM tells you when a change makes your prepared documents wrong.
          </p>
          <StatusCard intel={intel} />
        </div>
      </Container>
    </Bleed>
  );
}

/* ───────────── Your next steps ───────────── */

function ActionList({ intel }: { intel: DossierIntelligence }) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const reverify = useNiyomStore((s) => s.reverifyRequirement);
  const openInspector = useUiStore((s) => s.openInspector);
  const toast = useUiStore((s) => s.toast);
  const { notice, activeVersion, readinessSummary: s } = intel;
  const tag = versionTag(activeVersion.versionLabel);
  const stale = s.items.filter((i) => i.readinessStatus === "needs_reverification");
  const conflicts = s.items.filter((i) => i.requirement.conflict);
  const pending = s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES" && i.readinessStatus === "pending");
  const clear = !stale.length && !conflicts.length && !pending.length;

  return (
    <section data-rail="Your next steps" aria-labelledby="action" className="pt-24">
      <Container className="grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
        <div className="min-w-0">
          <h2 id="action" className="display text-[34px] sm:text-[40px]">
            Your next steps
          </h2>
          <p className="mt-3 max-w-[36ch] text-[18px] italic leading-snug text-ink-2">
            For {shortTitle(notice)}, as it stands in {tag}.
          </p>
        </div>
        <div className="min-w-0">
          {!hydrated ? (
            <div className="space-y-4">
              <Skel className="h-6 w-3/4" />
              <Skel className="h-20 w-full" />
            </div>
          ) : clear ? (
            <p className="text-[22px] italic leading-snug">Nothing to do. Every required item that applies to you matches {tag}.</p>
          ) : (
            <ol className="divide-y divide-ink/10">
              {stale.map((i) => (
                <li key={i.requirement.id} style={{ viewTransitionName: `act-${i.requirement.id}` }} className="py-6 first:pt-0">
                  <p className="text-[15.5px] italic text-warn">Changed under you</p>
                  <h3 className="mt-1 text-[21px] font-semibold leading-snug">{i.requirement.title}</h3>
                  <Redline className="mt-3" before={i.previouslyVerifiedValue ?? ""} after={i.requirement.value} fromTag="yours" toTag={tag} />
                  <Button
                    variant="warn"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      withViewTransition(() => reverify(notice.id, i.requirement, activeVersion.versionNumber));
                      toast({ tone: "ok", title: `${i.requirement.title} re-verified`, body: `Your check now holds against ${tag}.` });
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
    <section data-rail="Not every change is news" aria-labelledby="noise" className="pt-32">
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
                  <span className="display num text-[44px] leading-none">{versionTag(v.versionLabel)}</span>
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
        const facts: [string, React.ReactNode][] = [
          ["versions", notice.versions.length],
          ["changes that matter", changes],
          ["ready", hydrated ? `${s.percentage}%` : "—"],
        ];
        return (
          <Bleed
            key={notice.id}
            id={`chapter-${notice.id}`}
            data-cover={chapterOf(notice.id)}
            data-rail={shortTitle(notice)}
            aria-labelledby={`title-${notice.id}`}
            className="scroll-mt-[var(--bar-h)] py-24 lg:py-32"
          >
            <Container className="grid grid-cols-1 items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
              <Link href={`/notice/${notice.id}`} onClick={() => setActiveNotice(notice.id)} aria-label={`Open ${shortTitle(notice)}`} className="block min-w-0">
                <NoticeObject notice={notice} morph className="max-w-[460px]" />
              </Link>
              <div className="min-w-0">
                <p className="text-[16px] italic text-ink-2">{CATEGORY_LABEL[notice.category]}</p>
                <h2 id={`title-${notice.id}`} className="display mt-2 text-[38px] sm:text-[46px]">
                  {shortTitle(notice)}
                </h2>
                <p className="mt-3 text-[18px] italic leading-snug text-ink-2">{notice.title}</p>
                <p className="mt-7 text-[17px] leading-relaxed text-ink-2">{activeVersion.changeSummary}</p>
                <dl className="mt-8 grid grid-cols-3 gap-4">
                  {facts.map(([label, value]) => (
                    <div key={label} className="flex flex-col">
                      <dt className="mt-1.5 text-[15px] italic text-ink-2">{label}</dt>
                      <dd className="display num order-first text-[34px] leading-none">{value}</dd>
                    </div>
                  ))}
                </dl>
                <ActionRows className="mt-9">
                  <ActionRowLink
                    href={`/notice/${notice.id}`}
                    onClick={() => setActiveNotice(notice.id)}
                    label="Read the requirements"
                    meta={versionTag(activeVersion.versionLabel)}
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
      <Hero intel={intel} />
      <ActionList intel={intel} />
      <NoiseFilter />
      <Chapters />
    </Page>
  );
}
