"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { applicantProfileSchema } from "@/domain";
import type { ApplicantProfile, EvaluatedRequirementItem } from "@/domain/types";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useAllIntelligence, useDossierIntelligence, versionOf } from "@/hooks/useDossierIntelligence";
import { chapterOf } from "@/lib/chapters";
import { formatDate, plural, profileLine, shortTitle, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { CoverTile } from "@/components/ui/CoverTile";
import { AnimatedNumber, Button, Meter, Skel, withViewTransition } from "@/components/ui/primitives";
import { Deadline } from "@/components/ui/Deadline";
import { RequirementEntry } from "@/components/ledger/RequirementEntry";

const INSTITUTIONS: [string, string][] = [
  ["RUET", "Rajshahi University of Engineering & Technology (RUET)"],
  ["BUET", "Bangladesh University of Engineering & Technology (BUET)"],
  ["DU", "University of Dhaka (DU)"],
  ["KUET", "Khulna University of Engineering & Technology (KUET)"],
];

/* ───────────── Context controls ───────────── */

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-[var(--r-control)] bg-ink/[0.05] p-1">
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn(
              "h-9 flex-auto whitespace-nowrap rounded-[7px] px-2.5 text-[14.5px] transition-[background-color,color,box-shadow] duration-300",
              on ? "bg-ink text-ground shadow-[0_2px_8px_-4px_rgba(0,0,0,0.4)]" : "text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, affects, children }: { label: string; affects?: string[]; children: ReactNode }) {
  return (
    <div className="py-5">
      <p className="mb-2.5 text-[16px] italic text-ink-2">{label}</p>
      {children}
      {affects && affects.length > 0 && (
        <p className="mt-2 text-[14.5px] text-ink-3">
          Decides <span className="code text-[14.5px]">{affects.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

function Preset({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-8 whitespace-nowrap rounded-[8px] border px-2.5 text-[14.5px] transition-colors duration-300",
        on ? "border-ink bg-ink text-ground" : "border-ink/20 text-ink-2 hover:border-ink/60 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** Number input that commits only a value the profile schema accepts. */
function NumberField({
  value,
  onCommit,
  validate,
  ariaLabel,
  suffix,
}: {
  value: number | null;
  onCommit: (n: number) => void;
  validate: (n: number) => string | null;
  ariaLabel: string;
  suffix?: string;
}) {
  const shown = value === null ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setDraft(shown);
    setError(null);
  }
  const commit = () => {
    if (draft.trim() === "") return setDraft(shown);
    const n = Number(draft);
    const err = Number.isFinite(n) ? validate(n) : "Enter a number.";
    setError(err);
    if (!err && n !== value) onCommit(n);
  };
  return (
    <>
      <div className="relative">
        <input
          inputMode="decimal"
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          value={draft}
          placeholder={value === null ? "Not stated" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="num h-11 w-full border-b border-ink/50 bg-transparent text-[22px] transition-colors placeholder:italic placeholder:text-ink-3 hover:border-ink focus:border-ink focus:outline-none aria-[invalid=true]:border-crit"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[15px] italic text-ink-3">{suffix}</span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[14.5px] text-crit">
          {error}
        </p>
      )}
    </>
  );
}

function ProfileFields() {
  const profile = useNiyomStore((s) => s.profile);
  const updateProfile = useNiyomStore((s) => s.updateProfile);
  const notices = useNiyomStore((s) => s.notices);
  const known = INSTITUTIONS.find(([, full]) => full === profile.institution);
  const [custom, setCustom] = useState(known ? "" : profile.institution);
  const [customOpen, setCustomOpen] = useState(!known);
  // Profile changes move requirements between groups; let them glide.
  const update = (p: Partial<ApplicantProfile>) => withViewTransition(() => updateProfile(p));

  const affects = useMemo(() => {
    const map: Partial<Record<keyof ApplicantProfile, string[]>> = {};
    notices.forEach((n) =>
      versionOf(n, n.activeVersionNumber).requirements.forEach((r) => {
        if (r.applicability) (map[r.applicability.field] ??= []).push(r.code);
      })
    );
    return map;
  }, [notices]);

  const cgpaError = (n: number) =>
    applicantProfileSchema.shape.cgpa.safeParse(n).success ? null : "CGPA must be between 0.00 and 4.00.";

  return (
    <div className="divide-y divide-ink/15">
      <Field label="Institution">
        <Segmented
          label="Institution"
          value={customOpen ? "custom" : (known?.[0] ?? "custom")}
          options={[...INSTITUTIONS.map(([k]) => [k, k] as [string, string]), ["custom", "Other"]]}
          onChange={(v) => {
            if (v === "custom") return setCustomOpen(true);
            setCustomOpen(false);
            update({ institution: INSTITUTIONS.find(([k]) => k === v)![1] });
          }}
        />
        {customOpen && (
          <input
            autoFocus={Boolean(known)}
            aria-label="Institution name"
            value={custom}
            placeholder="Full institution name"
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => custom.trim() && update({ institution: custom.trim() })}
            onKeyDown={(e) => e.key === "Enter" && custom.trim() && update({ institution: custom.trim() })}
            className="mt-3 h-11 w-full border-b border-ink/50 bg-transparent text-[18px] placeholder:italic placeholder:text-ink-3 focus:border-ink focus:outline-none"
          />
        )}
      </Field>

      <Field label="Study level" affects={affects.studyLevel}>
        <Segmented
          label="Study level"
          value={profile.studyLevel}
          options={[
            ["undergraduate", "Undergraduate"],
            ["masters", "Masters"],
          ]}
          onChange={(studyLevel) => update({ studyLevel })}
        />
      </Field>

      <Field label="Academic year" affects={affects.currentYear}>
        <Segmented
          label="Academic year"
          value={profile.currentYear}
          options={[1, 2, 3, 4].map((y) => [y, `Year ${y}`] as [number, string])}
          onChange={(currentYear) => update({ currentYear })}
        />
      </Field>

      <Field label="CGPA" affects={affects.cgpa}>
        <NumberField value={profile.cgpa} ariaLabel="CGPA" suffix="of 4.00" validate={cgpaError} onCommit={(cgpa) => update({ cgpa })} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Preset on={profile.cgpa === 3.78} onClick={() => update({ cgpa: 3.78 })}>
            3.78 · eligible
          </Preset>
          <Preset on={profile.cgpa === 3.1} onClick={() => update({ cgpa: 3.1 })}>
            3.10 · below the 3.25 cut-off
          </Preset>
        </div>
      </Field>

      <Field label="Household income a year" affects={affects.householdIncomeLakhs}>
        <NumberField
          value={profile.householdIncomeLakhs}
          ariaLabel="Household income a year, in lakh taka"
          suffix="lakh BDT"
          validate={(n) => (n < 0 ? "Income cannot be negative." : null)}
          onCommit={(householdIncomeLakhs) => update({ householdIncomeLakhs })}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Preset on={profile.householdIncomeLakhs === 2.8} onClick={() => update({ householdIncomeLakhs: 2.8 })}>
            2.80 · within 3.5
          </Preset>
          <Preset on={profile.householdIncomeLakhs === 4.5} onClick={() => update({ householdIncomeLakhs: 4.5 })}>
            4.50 · above 3.5
          </Preset>
          <Preset on={profile.householdIncomeLakhs === null} onClick={() => update({ householdIncomeLakhs: null })}>
            I don&rsquo;t know
          </Preset>
        </div>
        {profile.householdIncomeLakhs === null && (
          <p className="mt-3 text-[15px] italic leading-snug text-warn">
            NIYOM never assumes you are ineligible when a field is missing. Rules that need it move to &ldquo;needs your
            profile&rdquo;.
          </p>
        )}
      </Field>

      <Field label="Payment or refund channel" affects={affects.paymentChannel}>
        <Segmented
          label="Payment or refund channel"
          value={profile.paymentChannel}
          options={[
            ["bkash_nagad", "bKash/Nagad"],
            ["card", "Card"],
            ["counter", "Counter"],
          ]}
          onChange={(paymentChannel) => update({ paymentChannel })}
        />
      </Field>
    </div>
  );
}

function ProfileSimulator() {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  if (!hydrated) {
    return (
      <div className="space-y-7 py-5" aria-busy>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <Skel className="mb-3 h-4 w-28" />
            <Skel className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  return <ProfileFields />;
}

/* ───────────── Print slip ───────────── */

function ReadinessSlip({ printedAt }: { printedAt: string }) {
  const intel = useDossierIntelligence();
  const profile = useNiyomStore((s) => s.profile);
  const records = useNiyomStore((s) => s.readinessRecords);
  if (!intel) return null;
  const { notice, activeVersion, readinessSummary: s } = intel;
  const status = (i: EvaluatedRequirementItem) =>
    i.applicability === "DOES_NOT_APPLY"
      ? "Not applicable"
      : i.applicability === "NEEDS_REVIEW"
        ? "Profile review"
        : i.readinessStatus === "completed"
          ? "Verified"
          : i.readinessStatus === "needs_reverification"
            ? "STALE"
            : "Pending";
  return (
    <section className="hidden text-black print:block">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
        <p className="text-[18pt] font-bold tracking-tight">NIYOM · Readiness slip</p>
        <p>Printed {printedAt}</p>
      </div>
      <p className="mt-3 font-semibold">{notice.title}</p>
      <p>
        {notice.institution} · {activeVersion.versionLabel} · published {formatDate(activeVersion.publishedAt)}
      </p>
      <p className="mt-1">Applicant: {profileLine(profile).join(" · ")}</p>
      <p className="mt-1">
        Readiness {s.percentage}% · {s.completedMandatoryCount} of {s.totalApplicableMandatoryCount} required verified ·{" "}
        {s.staleReverificationCount} stale · {s.conflictCount} source conflicts
      </p>
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-black">
            {["", "Code", "Requirement", "Status", "Checked against", "Source"].map((h) => (
              <th key={h} className="py-1 pr-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.items.map((i) => {
            const rec = records.find((r) => r.noticeId === notice.id && r.requirementId === i.requirement.id && r.checked);
            return (
              <tr key={i.requirement.id} className="border-b border-neutral-300 align-top">
                <td className="py-1.5 pr-2">{i.readinessStatus === "completed" ? "☑" : "☐"}</td>
                <td className="py-1.5 pr-2">{i.requirement.code}</td>
                <td className="py-1.5 pr-2">
                  <span className="font-semibold">{i.requirement.title}</span>
                  {i.requirement.mandatory ? "" : " (optional)"}
                  <br />
                  {i.requirement.value}
                </td>
                <td className="py-1.5 pr-2">{status(i)}</td>
                <td className="py-1.5 pr-2">{rec ? versionTag(versionOf(notice, rec.verifiedAgainstVersion).versionLabel) : "—"}</td>
                <td className="py-1.5">{i.requirement.evidence.sectionOrPage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-[8.5pt]">
        Readiness measures self-verified preparation against applicable requirements in the active notice version. It does not
        guarantee institutional selection or official transaction status. Illustrative dataset.
      </p>
    </section>
  );
}

/* ───────────── Screen ───────────── */

function Group({ id, title, meta, items, children }: { id: string; title: string; meta: string; items: number; children: ReactNode }) {
  if (!items) return null;
  return (
    <section data-rail={title} aria-labelledby={id} className="mt-16 scroll-mt-28 first:mt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="display text-[30px]">
          {title}
        </h2>
        <span className="text-[15px] italic text-ink-3">{meta}</span>
      </div>
      {children}
    </section>
  );
}

export function MyPlanScreen() {
  const all = useAllIntelligence();
  const intel = useDossierIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const [printedAt, setPrintedAt] = useState("");

  useEffect(() => {
    if (location.hash === "#profile") document.getElementById("profile")?.scrollIntoView({ block: "start" });
  }, []);

  if (!intel) return null;
  const { notice, activeVersion, baselineVersion, readinessSummary: s } = intel;
  const tag = versionTag(activeVersion.versionLabel);
  const baselineTag = versionTag(baselineVersion.versionLabel);

  const stale = s.items.filter((i) => i.readinessStatus === "needs_reverification");
  const required = s.items.filter((i) => i.requirement.mandatory && i.applicability === "APPLIES" && i.readinessStatus !== "needs_reverification");
  const review = s.items.filter((i) => i.applicability === "NEEDS_REVIEW" && i.readinessStatus !== "needs_reverification");
  const optional = s.items.filter(
    (i) =>
      i.readinessStatus !== "needs_reverification" &&
      (i.applicability === "DOES_NOT_APPLY" || (!i.requirement.mandatory && i.applicability === "APPLIES"))
  );
  const pendingRequired = required.filter((i) => i.readinessStatus !== "completed");

  const entries = (items: EvaluatedRequirementItem[]) => (
    <ul className="mt-4">
      {items.map((item) => (
        <RequirementEntry
          key={item.requirement.id}
          item={item}
          notice={notice}
          activeVersion={activeVersion}
          baselineTag={baselineTag}
          hydrated={hydrated}
          scope="plan"
        />
      ))}
    </ul>
  );

  return (
    <Page chapter={chapterOf(notice.id)}>
      <div className="print:hidden">
        <header data-rail="Your dossiers" className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[720px]">
            <h1 className="display text-[44px] sm:text-[56px]">My preparation plan</h1>
            <p className="mt-4 text-[22px] italic leading-snug text-ink-2">
              Your checklist for each dossier, re-read every time a version, a check or your context changes.
            </p>
          </div>
          <Button
            onClick={() => {
              setPrintedAt(formatDate(new Date().toISOString().slice(0, 10)));
              setTimeout(() => window.print(), 60);
            }}
          >
            <Printer className="h-4 w-4" /> Print a readiness slip
          </Button>
        </header>

        <div role="tablist" aria-label="Dossier" className="scroll-x -mx-4 mt-10 flex gap-4 px-4 pb-6 pt-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
          {all.map((d) => {
            const on = d.notice.id === notice.id;
            return (
              <button
                key={d.notice.id}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => withViewTransition(() => setActiveNotice(d.notice.id))}
                className={cn(
                  "group w-[180px] flex-none text-left outline-offset-4 sm:w-auto"
                )}
              >
                <CoverTile
                  noticeId={d.notice.id}
                  category={d.notice.category}
                  title={shortTitle(d.notice)}
                  top={versionTag(d.activeVersion.versionLabel)}
                  bottom={
                    hydrated
                      ? `${d.readinessSummary.percentage}% ready${d.readinessSummary.staleReverificationCount ? ` · ${d.readinessSummary.staleReverificationCount} stale` : ""}`
                      : "…"
                  }
                  className={cn("h-36 w-full", on ? "-translate-y-1.5" : "group-hover:-translate-y-1")}
                />
                <span
                  aria-hidden
                  className={cn("mt-3 block h-[2px] origin-left bg-ink transition-transform duration-500 ease-spring", on ? "scale-x-100" : "scale-x-0")}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-12 grid grid-cols-1 items-start gap-x-14 gap-y-12 lg:grid-cols-[minmax(320px,370px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] xl:gap-x-20">
          <div data-rail="Readiness" className="lg:col-start-1 lg:row-start-1">
            <p className="text-[16px] italic text-ink-3">
              Readiness for {shortTitle(notice)}, checked against {tag}
            </p>
            <p className="display mt-2 text-[96px] leading-[0.95]">
              {hydrated ? <AnimatedNumber value={s.percentage} /> : <Skel className="h-20 w-36" />}
              <span className="text-[48px]">%</span>
            </p>
            <p className="num mt-3 text-[17px] text-ink-2">
              {hydrated ? `${s.completedMandatoryCount} of ${s.totalApplicableMandatoryCount} required items verified` : <Skel className="h-4 w-52" />}
            </p>
            <Meter value={hydrated ? s.percentage : 0} className="mt-5" />
            <Deadline notice={notice} compact className="mt-5" />
            <p className="mt-5 text-[14.5px] italic leading-relaxed text-ink-3">
              Readiness measures your own checks against the requirements that apply to you in the active version. It does not
              guarantee selection or an official outcome.
            </p>

          </div>

          <aside
            id="profile"
            data-rail="Your context"
            aria-labelledby="ctx"
            className="scroll-mt-28 rounded-[var(--r-panel)] bg-white/50 p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)] lg:col-start-1 lg:row-start-2"
          >
            <h2 id="ctx" className="display text-[26px]">
              Your context
            </h2>
            <p className="mt-3 text-[15.5px] italic leading-snug text-ink-3">
              Change a field and every rule re-evaluates at once. Saved on this device.
            </p>
            <ProfileSimulator />
          </aside>

          <div className="min-w-0 max-w-[760px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {hydrated && (
              <div
                className={cn(
                  "mb-14 rounded-[var(--r-panel)] px-6 py-5 transition-colors duration-500",
                  stale.length ? "bg-warn/[0.09]" : pendingRequired.length ? "bg-ink/[0.045]" : "bg-ok/[0.09]"
                )}
              >
                <p className={cn("text-[16px] italic", stale.length ? "text-warn" : pendingRequired.length ? "text-ink-3" : "text-ok")}>
                  Next step
                </p>
                <p className="mt-1 text-[22px] leading-snug">
                  {stale.length
                    ? `Re-verify ${plural(stale.length, "item")} that ${tag} changed under you.`
                    : pendingRequired.length
                      ? `Prepare ${plural(pendingRequired.length, "required item")} still unchecked.`
                      : `You are ready for ${tag}. Keep the slip with your documents.`}
                </p>
              </div>
            )}

            <Group id="g-stale" title="Changed under you" meta={`${stale.length} to re-verify`} items={stale.length}>
              {entries(stale)}
            </Group>
            <Group
              id="g-required"
              title="Required"
              meta={`${required.filter((i) => i.readinessStatus === "completed").length} of ${required.length} checked`}
              items={required.length || 1}
            >
              {required.length ? (
                entries(required)
              ) : (
                <p className="mt-6 border-t border-ink/15 pt-6 text-[18px] italic text-ink-3">
                  No required item applies to your current context in {tag}.
                </p>
              )}
            </Group>
            <Group id="g-review" title="Needs your profile" meta={`${review.length} undecided`} items={review.length}>
              {entries(review)}
            </Group>
            <Group id="g-optional" title="Optional, or not for you" meta="never block readiness" items={optional.length}>
              {entries(optional)}
            </Group>
          </div>
        </div>
      </div>
      <ReadinessSlip printedAt={printedAt} />
    </Page>
  );
}
