"use client";

import type { PreparationTimeline, SharedFolderGroup } from "@/domain";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { formatDate, plural, shortTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skel } from "@/components/ui/primitives";

const WEEKDAY = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

/** One sentence that answers "when do I have to start?", plus the reason. Shown only after hydration (it depends on today). */
export function scheduleHeadline(t: PreparationTimeline): { title: string; body: string; tone: "ok" | "warn" | "crit" | "ink" } {
  const visits = `${plural(t.remainingLeadDays, "working day")} at the offices that issue your remaining papers`;
  if (t.scheduleStatus === "complete") return { title: "Every office visit is done.", body: "Nothing is left to collect for this version.", tone: "ok" };
  if (t.scheduleStatus === "no_dated_deadline" || !t.latestSafeStartDate || !t.deadlineDate)
    return { title: "No fixed deadline.", body: `You still need about ${visits}. Start when you can.`, tone: "ink" };
  const start = `${WEEKDAY(t.latestSafeStartDate)}, ${formatDate(t.latestSafeStartDate)}`;
  const why = `You need about ${visits}, and offices close on Friday and Saturday. That is the latest start that still finishes before ${formatDate(t.deadlineDate)}.`;
  if (t.scheduleStatus === "behind")
    return {
      title: "Start today.",
      body: `You need about ${visits}, and offices close on Friday and Saturday, so you are ${plural(-(t.bufferDaysRemaining ?? 0), "day")} behind for ${formatDate(t.deadlineDate)}. Begin with the longest visits.`,
      tone: "crit",
    };
  if (t.scheduleStatus === "tight") return { title: `Start by ${start}.`, body: `${why} That leaves ${plural(t.bufferDaysRemaining ?? 0, "day")} in hand.`, tone: "warn" };
  return { title: `Start by ${start}.`, body: why, tone: "ok" };
}

const STAGE_TITLE = { 1: "Civic offices and banks", 2: "Signatures and attestation", 3: "Final submission" } as const;
const STATUS = {
  completed: ["Done", "text-ok"],
  needs_reverification: ["Re-check", "text-warn"],
  pending: ["", "text-ink-3"],
  exempt: ["Not for you", "text-ink-3"],
} as const;

/**
 * When to start, and in what order: the counter-day plan for one dossier (Bangladesh offices work
 * Sunday to Thursday), then papers that other dossiers need from the same place.
 */
export function PrepSchedule({
  timeline,
  groups,
  noticeId,
  onInspect,
}: {
  timeline: PreparationTimeline;
  groups: SharedFolderGroup[];
  noticeId: string;
  onInspect: (noticeId: string, requirementId: string) => void;
}) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const notices = useNiyomStore((s) => s.notices);
  const head = scheduleHeadline(timeline);
  const stages = ([1, 2, 3] as const)
    .map((stage) => ({ stage, steps: timeline.steps.filter((s) => s.stage === stage) }))
    .filter((s) => s.steps.length > 0);
  const folders = groups.filter((g) => g.peers.some((p) => p.noticeId === noticeId) && g.peers.length > 1);

  return (
    <section aria-labelledby="schedule" className="rounded-[var(--r-panel)] bg-white/55 p-6 shadow-[0_0_0_1px_var(--hair)] sm:p-8">
      <p className="text-[16px] italic text-ink-3">When to start</p>
      {hydrated ? (
        <>
          <h2
            id="schedule"
            className={cn(
              "display mt-1 text-[32px] sm:text-[40px]",
              head.tone === "crit" ? "text-crit" : head.tone === "warn" ? "text-warn" : ""
            )}
          >
            {head.title}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-ink-2">{head.body}</p>
        </>
      ) : (
        <div aria-busy className="mt-2 space-y-3">
          <Skel className="h-9 w-72" />
          <Skel className="h-4 w-full max-w-[520px]" />
        </div>
      )}

      <ol className="mt-8 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
        {stages.map(({ stage, steps }, i) => {
          const open = steps.filter((s) => s.status !== "completed");
          const left = open.reduce((a, s) => a + s.leadDays, 0);
          return (
            <li key={stage} className="min-w-0 border-t border-ink/15 pt-4">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-semibold">
                  <span className="num mr-2 text-ink-3">{i + 1}</span>
                  {STAGE_TITLE[stage]}
                </span>
                <span className="num flex-none text-[14.5px] italic text-ink-3">{!open.length ? "done" : left ? `~${plural(left, "day")}` : "same day"}</span>
              </p>
              <ul className="mt-2">
                {steps.map((step) => {
                  const [label, tone] = STATUS[step.status];
                  return (
                    <li key={step.requirementId}>
                      <button
                        type="button"
                        onClick={() => onInspect(noticeId, step.requirementId)}
                        className="group flex w-full items-baseline justify-between gap-3 py-2 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-[16px] leading-snug group-hover:underline group-hover:decoration-ink/30 group-hover:underline-offset-4">
                            {step.title}
                          </span>
                          <span className="block truncate text-[14px] text-ink-3">
                            {step.office}
                            {step.evidenceNote ? `, note: ${step.evidenceNote}` : ""}
                          </span>
                        </span>
                        <span className={cn("num flex-none text-[14px]", tone)}>
                          {hydrated ? label || (step.leadDays ? `~${plural(step.leadDays, "day")}` : "same day") : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {folders.map((g) => (
        <div key={g.groupId} className="mt-10 border-t border-ink/15 pt-5">
          <p className="text-[17px] font-semibold">{g.title}</p>
          <p className="mt-1 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2">{g.description}</p>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {g.peers.map((p) => {
              const [label, tone] = STATUS[p.status];
              return (
                <li key={`${p.noticeId}-${p.requirementId}`}>
                  <button
                    type="button"
                    onClick={() => onInspect(p.noticeId, p.requirementId)}
                    className="group flex w-full items-baseline justify-between gap-3 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[16px] leading-snug group-hover:underline group-hover:decoration-ink/30 group-hover:underline-offset-4">
                        {p.title}
                      </span>
                      <span className="block truncate text-[14px] italic text-ink-3">
                        {p.noticeId === noticeId ? "This dossier" : shortTitle(notices.find((n) => n.id === p.noticeId)!)}
                      </span>
                    </span>
                    <span className={cn("flex-none text-[14px]", tone)}>{hydrated ? label || "Not yet" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
