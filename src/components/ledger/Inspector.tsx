"use client";

import { X } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useDossierIntelligence } from "@/hooks/useDossierIntelligence";
import { APPLICABILITY_LABEL, REVIEW_LABEL, shortTitle, versionTag } from "@/lib/format";
import { chapterOf } from "@/lib/chapters";
import { cn } from "@/lib/utils";
import { Button, Check, Overlay, Stamp, withViewTransition } from "@/components/ui/primitives";
import { Deadline } from "@/components/ui/Deadline";
import { ConflictNote, EvidenceQuote, FieldReports, Redline, ruleExplanation } from "./parts";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 py-6">
      <h3 className="mb-3 text-[15.5px] italic text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/** Everything about one requirement, resolved live from ids so it never shows a stale version. */
function Body({ noticeId, requirementId, onClose }: { noticeId: string; requirementId: string; onClose: () => void }) {
  const intel = useDossierIntelligence(noticeId);
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const profile = useNiyomStore((s) => s.profile);
  const toggle = useNiyomStore((s) => s.toggleRequirementCheck);
  const reverify = useNiyomStore((s) => s.reverifyRequirement);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const toast = useUiStore((s) => s.toast);
  const item = intel?.readinessSummary.items.find((i) => i.requirement.id === requirementId);

  if (!intel || !item) {
    return (
      <div className="ov-right flex h-full flex-col bg-ground px-7 py-8 sm:rounded-l-[var(--r-panel)]">
        <p className="text-[18px] italic text-ink-2">This requirement is not part of the version you are viewing.</p>
        <Button className="mt-6 self-start" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const { notice, activeVersion, baselineVersion } = intel;
  const r = item.requirement;
  const tag = versionTag(activeVersion.versionLabel);
  const baseTag = versionTag(baselineVersion.versionLabel);
  const stale = item.readinessStatus === "needs_reverification";
  const changed = item.latestChange && item.latestChange.type === "modified" && item.latestChange.previous;

  return (
    <div data-chapter={chapterOf(notice.id)} className="ov-right flex h-full flex-col overflow-hidden bg-ground text-ink sm:rounded-l-[var(--r-panel)]">
      <div className="flex items-start justify-between gap-4 px-7 pb-5 pt-7">
        <div className="min-w-0">
          <p className="text-[15px] italic text-ink-3">
            {shortTitle(notice)}, {tag}
          </p>
          <h2 className="display mt-2 text-[28px] leading-[1.12]">{r.title}</h2>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <Stamp tone="plain">{r.code}</Stamp>
            <Stamp tone={r.mandatory ? "ink" : "plain"}>{r.mandatory ? "Required" : "Optional"}</Stamp>
            {stale && hydrated && <Stamp tone="warn">Stale</Stamp>}
            {r.reviewState === "conflict" && <Stamp tone="crit">Sources disagree</Stamp>}
          </p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="-mr-2 flex-none">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-10">
        <Section title="What the notice requires">
          <p className="text-[19px] leading-relaxed">{r.value}</p>
          {r.category === "deadline" && <Deadline notice={notice} className="mt-4" />}
        </Section>

        <Section title="Your status">
          {stale && hydrated ? (
            <div className="rounded-[var(--r-card)] bg-warn/[0.08] p-4">
              <p className="text-[16px] text-warn">You checked this against an earlier wording.</p>
              <Redline className="mt-3" before={item.previouslyVerifiedValue ?? ""} after={r.value} fromTag="yours" toTag={tag} />
              <Button
                variant="warn"
                size="sm"
                className="mt-4"
                onClick={() => {
                  withViewTransition(() => reverify(notice.id, r, activeVersion.versionNumber));
                  toast({ tone: "ok", title: `${r.title} re-verified`, body: `Your check now holds against ${tag}.` });
                }}
              >
                I have the updated document
              </Button>
            </div>
          ) : (
            <label className={cn("flex items-center gap-3", item.applicability === "DOES_NOT_APPLY" && "opacity-60")}>
              <Check
                status={item.readinessStatus}
                loading={!hydrated}
                disabled={item.applicability === "DOES_NOT_APPLY"}
                label={r.title}
                onToggle={() => withViewTransition(() => toggle(notice.id, r, activeVersion.versionNumber))}
              />
              <span className="text-[17px]">
                {item.readinessStatus === "completed" ? `Checked against ${tag}` : "Not checked yet"}
              </span>
            </label>
          )}
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            <span className={cn(item.applicability === "APPLIES" ? "text-ok" : item.applicability === "NEEDS_REVIEW" ? "text-warn" : "text-ink-3")}>
              {APPLICABILITY_LABEL[item.applicability]}.
            </span>{" "}
            {r.applicability ? (
              <>
                The rule is <span className="num">{r.applicability.humanLabel}</span>; your profile gives{" "}
                <span className="num">{ruleExplanation(r.applicability, profile)}</span>.
              </>
            ) : (
              "It applies to every applicant."
            )}
            {item.applicability === "NEEDS_REVIEW" && " NIYOM never assumes you are ineligible when a field is missing."}
          </p>
        </Section>

        {changed && (
          <Section title={`What changed since ${baseTag}`}>
            {latestValueChanged(item) ? (
              <Redline before={item.latestChange!.previous!.value} after={r.value} fromTag={baseTag} toTag={tag} />
            ) : (
              <p className="text-[16px] text-ink-2">The wording is the same; its review state or applicability changed.</p>
            )}
            <p className="mt-3 text-[16px] italic leading-relaxed text-ink-2">{item.latestChange!.explanation}</p>
          </Section>
        )}

        {r.conflict && (
          <Section title="Official sources">
            <ConflictNote requirement={r} sources={notice.sources} />
          </Section>
        )}

        <Section title="Where this comes from">
          <EvidenceQuote requirement={r} sources={notice.sources} />
          <p className="mt-3 text-[14.5px] text-ink-3">Review state: {REVIEW_LABEL[r.reviewState].toLowerCase()}.</p>
        </Section>

        <Section title="What applicants report">
          {item.communityReports.length ? (
            <FieldReports reports={item.communityReports} onAdd={() => openDrawer({ noticeId: notice.id, requirementId: r.id })} />
          ) : (
            <p className="text-[16px] text-ink-2">
              No field reports yet.{" "}
              <button
                type="button"
                onClick={() => openDrawer({ noticeId: notice.id, requirementId: r.id })}
                className="font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                Report what you saw
              </button>
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function latestValueChanged(item: { latestChange?: { previous?: { value: string } }; requirement: { value: string } }) {
  return item.latestChange?.previous?.value !== item.requirement.value;
}

export function Inspector() {
  const target = useUiStore((s) => s.inspector);
  const close = useUiStore((s) => s.closeInspector);
  return (
    <Overlay open={target !== null} onClose={close} label="Requirement details" placement="right">
      {target && <Body key={`${target.noticeId}-${target.requirementId}`} {...target} onClose={close} />}
    </Overlay>
  );
}
