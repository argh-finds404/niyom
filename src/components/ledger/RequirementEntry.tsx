"use client";

import { ChevronRight } from "lucide-react";
import type { EvaluatedRequirementItem, Notice, NoticeVersion } from "@/domain/types";
import { getRequirementOfficeMeta } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Check, Stamp, withViewTransition } from "@/components/ui/primitives";
import { Redline } from "./parts";

/**
 * One requirement, kept quiet: the check, the rule, and one status at most.
 * Everything else (source, applicability maths, history, reports) opens in the inspector.
 * A stale check is the exception: its redline and the fix stay in view, because that is the job.
 */
export function RequirementEntry({
  item,
  notice,
  activeVersion,
  hydrated,
  scope,
}: {
  item: EvaluatedRequirementItem;
  notice: Notice;
  activeVersion: NoticeVersion;
  baselineTag?: string;
  hydrated: boolean;
  /** Prefix for view-transition names; must differ between screens. */
  scope: "spec" | "plan";
}) {
  const toggle = useNiyomStore((s) => s.toggleRequirementCheck);
  const reverify = useNiyomStore((s) => s.reverifyRequirement);
  const openInspector = useUiStore((s) => s.openInspector);
  const toast = useUiStore((s) => s.toast);

  const { requirement: r, readinessStatus, latestChange } = item;
  const stale = readinessStatus === "needs_reverification";
  const done = readinessStatus === "completed";
  const exempt = item.applicability === "DOES_NOT_APPLY";
  const review = item.applicability === "NEEDS_REVIEW";
  const tag = versionTag(activeVersion.versionLabel);
  const escalated = latestChange?.type === "modified" && latestChange.previous && !latestChange.previous.mandatory && r.mandatory;
  const changed = latestChange && latestChange.type !== "unchanged";
  const officeMeta = getRequirementOfficeMeta(r.id, activeVersion.versionNumber);

  // One status, in order of what matters most.
  const status =
    hydrated && stale
      ? { tone: "warn" as const, text: "Needs re-verifying" }
      : r.reviewState === "conflict"
        ? { tone: "crit" as const, text: "Sources disagree" }
        : latestChange?.type === "added"
          ? { tone: "crit" as const, text: `New in ${tag}` }
          : escalated
            ? { tone: "crit" as const, text: "Now required" }
            : review
              ? { tone: "warn" as const, text: "Needs your profile" }
              : changed
                ? { tone: "plain" as const, text: `Changed in ${tag}` }
                : null;

  const onReverify = () => {
    withViewTransition(() => reverify(notice.id, r, activeVersion.versionNumber));
    toast({ tone: "ok", title: `${r.title} re-verified`, body: `Your check now holds against ${tag}.` });
  };
  const open = () => openInspector({ noticeId: notice.id, requirementId: r.id });

  return (
    <li
      id={scope === "spec" ? `req-${r.id}` : `plan-req-${r.id}`}
      style={{ viewTransitionName: `${scope}-${r.id}` }}
      className={cn(
        "req-anchor group/entry relative -mx-4 grid scroll-mt-[calc(var(--bar-h)+40px)] grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-4 rounded-[var(--r-card)] px-4 py-5 transition-colors duration-300",
        stale && hydrated ? "bg-warn/[0.07]" : "hover:bg-ink/[0.035]"
      )}
    >
      <div className="pt-[3px]">
        <Check
          status={readinessStatus}
          loading={!hydrated}
          disabled={exempt}
          label={r.title}
          onToggle={() => (stale ? onReverify() : withViewTransition(() => toggle(notice.id, r, activeVersion.versionNumber)))}
        />
      </div>

      <button type="button" onClick={open} className="min-w-0 text-left" aria-label={`${r.title}: details`}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("text-[19px] font-semibold leading-snug tracking-[-0.01em] transition-opacity", exempt && "opacity-55")}>
            {r.title}
          </span>
          {status && <Stamp tone={status.tone}>{status.text}</Stamp>}
        </span>
        <span className={cn("mt-1 line-clamp-2 block max-w-[62ch] text-[16.5px] leading-relaxed text-ink-2", exempt && "opacity-60")}>
          {r.value}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] text-ink-3">
          <span>
            {r.mandatory ? "Required" : "Optional"}
            {exempt ? ", not for your profile" : review ? ", depends on a field you have not filled" : ""}
            {hydrated && done && <span className="text-ok">, checked against {tag}</span>}
          </span>
          {!exempt && officeMeta.leadDays > 0 && (
            <span className="num">
              · {officeMeta.office} (~{officeMeta.leadDays}d)
            </span>
          )}
          {hydrated && item.evidenceNote && (
            <span className="inline-flex items-center rounded bg-paper px-2 py-0.5 text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--hair)]">
              Memo: <strong className="ml-1 font-medium text-ink">{item.evidenceNote}</strong>
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={open}
        aria-hidden
        tabIndex={-1}
        className="mt-1 grid h-8 w-8 place-items-center rounded-full text-ink-3 opacity-0 transition-[opacity,transform] duration-300 group-hover/entry:translate-x-0.5 group-hover/entry:opacity-100"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {stale && hydrated && (
        <div className="col-start-2 col-end-4 mt-4">
          <Redline before={item.previouslyVerifiedValue ?? ""} after={r.value} fromTag="yours" toTag={tag} />
          {item.evidenceNote && (
            <p className="mt-2.5 text-[14.5px] text-ink-2">
              Your v1.0 folder memo:{" "}
              <span className="font-medium text-ink">&ldquo;{item.evidenceNote}&rdquo;</span> — open details to update once re-verified.
            </p>
          )}
          <Button variant="warn" size="sm" className="mt-4" onClick={onReverify}>
            I have the updated document
          </Button>
        </div>
      )}
    </li>
  );
}
