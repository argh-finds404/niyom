"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { ApplicabilityRule, ApplicantProfile, CommunityReport, Requirement, Source } from "@/domain/types";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { wordDiff, type DiffToken } from "@/lib/wordDiff";
import { formatDate, REPORT_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ───────────── Redline ───────────── */

/** One side of a word diff: struck deletions on the "before" side, highlighter on the "after" side. */
export function RedlineText({ tokens, side, className }: { tokens: DiffToken[]; side: "before" | "after"; className?: string }) {
  return (
    <span className={className}>
      {tokens
        .filter((t) => t.kind === "same" || (side === "before" ? t.kind === "del" : t.kind === "add"))
        .map((t, i) => (
          <span key={i}>
            {i > 0 && " "}
            {t.kind === "same" ? (
              t.text
            ) : t.kind === "del" ? (
              <del className="text-crit decoration-crit/80 decoration-[1.5px]">{t.text}</del>
            ) : (
              <ins className="bg-[color-mix(in_srgb,#e9c46a_55%,transparent)] px-0.5 text-ink no-underline [box-decoration-break:clone]">
                {t.text}
              </ins>
            )}
          </span>
        ))}
    </span>
  );
}

/** "Before / after" pair, used inside entries. */
export function Redline({
  before,
  after,
  fromTag,
  toTag,
  className,
}: {
  before: string;
  after: string;
  fromTag: string;
  toTag: string;
  className?: string;
}) {
  const tokens = wordDiff(before, after);
  return (
    <dl className={cn("grid grid-cols-1 gap-x-4 gap-y-1.5 text-[16px] leading-relaxed sm:grid-cols-[64px_minmax(0,1fr)]", className)}>
      <dt className="code pt-0.5 text-[14px] text-ink-3">{fromTag}</dt>
      <dd className="min-w-0 break-words">
        <RedlineText tokens={tokens} side="before" className="text-ink-3" />
      </dd>
      <dt className="code pt-0.5 text-[14px] text-ink">{toTag}</dt>
      <dd className="min-w-0 break-words">
        <RedlineText tokens={tokens} side="after" />
      </dd>
    </dl>
  );
}

/* ───────────── Applicability ───────────── */

const FIELD_LABEL: Record<ApplicabilityRule["field"], string> = {
  studyLevel: "Study level",
  currentYear: "Academic year",
  cgpa: "CGPA",
  householdIncomeLakhs: "Household income",
  paymentChannel: "Payment channel",
};
const OP: Record<ApplicabilityRule["operator"], [string, string]> = {
  equals: ["=", "≠"],
  gte: ["≥", "<"],
  lte: ["≤", ">"],
};
const VALUE_LABEL: Record<string, string> = {
  bkash_nagad: "bKash/Nagad",
  card: "card",
  counter: "counter",
  undergraduate: "undergraduate",
  masters: "masters",
};

/** "CGPA 3.78 ≥ 3.25" — the exact comparison the engine made, from the profile it used. */
export function ruleExplanation(rule: ApplicabilityRule | undefined, profile: ApplicantProfile): string {
  if (!rule) return "applies to every applicant";
  const value = profile[rule.field];
  if (value === null || value === undefined) {
    return `${FIELD_LABEL[rule.field].toLowerCase()} not in your profile`;
  }
  const expNum = Number(rule.expected);
  const fmt = (v: string | number) => {
    if (typeof v !== "number") return VALUE_LABEL[v] ?? v;
    if (rule.field === "currentYear") return String(v);
    const two = v.toFixed(2);
    if (Number.isFinite(expNum) && v !== expNum && two === expNum.toFixed(2)) {
      return Number(v.toFixed(4)).toString();
    }
    return two;
  };
  const ok =
    rule.operator === "equals"
      ? String(value) === String(rule.expected)
      : rule.operator === "gte"
        ? Number(value) >= expNum
        : Number(value) <= expNum;
  const unit = rule.field === "householdIncomeLakhs" ? "L" : "";
  return `${FIELD_LABEL[rule.field]} ${fmt(value)}${unit} ${OP[rule.operator][ok ? 0 : 1]} ${fmt(rule.expected)}${unit}`;
}

/* ───────────── Conflict: both official sources quoted side by side ───────────── */

function Quote({ by, date, children }: { by: string; date?: string; children: ReactNode }) {
  return (
    <figure className="min-w-0 break-words">
      <span aria-hidden className="block h-6 text-[40px] font-bold leading-none">
        &ldquo;
      </span>
      <blockquote className="mt-2 text-[16.5px] leading-relaxed">{children}</blockquote>
      <span aria-hidden className="mt-3 block h-px w-10 bg-ink/50" />
      <figcaption className="mt-2 text-[15px] leading-snug">
        {by}
        {date && <span className="num block text-ink-3">{formatDate(date)}</span>}
      </figcaption>
    </figure>
  );
}

export function ConflictNote({ requirement, sources }: { requirement: Requirement; sources: Source[] }) {
  if (!requirement.conflict) return null;
  const c = requirement.conflict;
  const primary = sources.find((s) => s.id === requirement.evidence.sourceId);
  const competing = sources.find((s) => s.id === c.competingSourceId);
  return (
    <div className="mt-5 border-l-[3px] border-crit pl-5">
      <p className="text-[15.5px] italic text-crit">Two official sources disagree</p>
      <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Quote by={primary?.authority ?? "Primary source"} date={primary?.publishedAt}>
          {requirement.evidence.excerpt}
        </Quote>
        <Quote by={c.competingAuthority} date={competing?.publishedAt}>
          {c.competingExcerpt}
        </Quote>
      </div>
      <p className="mt-5 text-[16px] leading-relaxed">
        <span className="italic">Safe course: </span>
        {c.resolutionGuidance}
      </p>
    </div>
  );
}

/* ───────────── Community field reports ───────────── */

const CORROBORATE_TOAST = {
  ok: { tone: "ok", title: "Thanks for confirming", body: "Your confirmation counts once. Three independent devices make a pattern." },
  duplicate: { tone: "neutral", title: "Already confirmed", body: "Each device can confirm a report once." },
  own: { tone: "neutral", title: "This is your report", body: "Other applicants need to confirm it." },
  offline: { tone: "warn", title: "Couldn't reach the server", body: "Your confirmation was not recorded. Try again when you are online." },
  error: { tone: "warn", title: "Couldn't confirm this report", body: "Please try again in a moment." },
} as const;

export function FieldReports({ reports, onAdd }: { reports: CommunityReport[]; onAdd: () => void }) {
  const corroborate = useNiyomStore((s) => s.corroborateReport);
  const mine = useNiyomStore((s) => s.myReportIds);
  const confirmed = useNiyomStore((s) => s.myConfirmedIds);
  const toast = useUiStore((s) => s.toast);
  if (!reports.length) return null;
  return (
    <div className="mt-5 border-l border-dashed border-ink/40 pl-5">
      <p className="text-[15.5px] italic text-ink-2">
        Field reports from applicants <span className="text-ink-3">· kept apart from official policy</span>
      </p>
      <ul className="mt-2 divide-y divide-ink/10">
        {reports.map((r) => (
          <li key={r.id} className="py-3">
            <p className="break-words text-[16px] leading-relaxed">{r.observation}</p>
            <p className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px] text-ink-3">
              <span className="italic">{REPORT_TYPE_LABEL[r.reportType]}</span>
              <span>{formatDate(r.submittedAt)}</span>
              <span className="break-all">{r.evidenceUrlOrRef}</span>
              {r.verificationStatus === "corroborated_pattern" ? (
                <span className="text-ink-2">{r.corroborationCount} applicants report the same</span>
              ) : (
                <span className="text-warn">Pending verification · {r.corroborationCount} seen</span>
              )}
              {mine.includes(r.id) ? (
                <span className="italic text-ink-3">You reported this</span>
              ) : confirmed.includes(r.id) ? (
                <span className="italic text-ok">You confirmed this</span>
              ) : (
                <button
                  type="button"
                  onClick={async () => toast({ ...CORROBORATE_TOAST[await corroborate(r.id)] })}
                  className="tap rounded-[6px] border border-ink/20 px-2 py-0.5 text-[13px] text-ink-2 transition-colors hover:border-ink/60 hover:bg-ink/[0.04] hover:text-ink"
                >
                  I saw this too
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="tap mt-1 text-[15px] italic text-ink-2 underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
      >
        Add what you saw
      </button>
    </div>
  );
}

/* ───────────── Disclosure ───────────── */

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="tap inline-flex items-center gap-1.5 text-[15px] italic text-ink-2 transition-colors hover:text-ink"
      >
        {open ? "Hide" : summary}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-500 ease-spring", open && "rotate-180")} />
      </button>
      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-spring",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function EvidenceQuote({ requirement, sources }: { requirement: Requirement; sources: Source[] }) {
  const source = sources.find((s) => s.id === requirement.evidence.sourceId);
  return (
    <figure className="border-l border-ink pl-4">
      <blockquote className="break-words text-[16px] italic leading-relaxed">&ldquo;{requirement.evidence.excerpt}&rdquo;</blockquote>
      <figcaption className="mt-2 text-[14.5px] text-ink-3">
        {requirement.evidence.sectionOrPage}
        {source && (
          <>
            {" · "}
            {source.authority}, <span className="italic">{source.documentTitle}</span>,{" "}
            <span className="num">{formatDate(source.publishedAt)}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
