"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell } from "lucide-react";
import { SEED_NOTICES } from "@/data/seed/notices.seed";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useWatchStore } from "@/hooks/useWatchStore";
import { useAllIntelligence } from "@/hooks/useDossierIntelligence";
import { deriveAlerts } from "@/lib/alerts";
import { chapterOf } from "@/lib/chapters";
import { formatDate, plural, shortTitle, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEED_SEEN = Object.fromEntries(SEED_NOTICES.map((n) => [n.id, n.activeVersionNumber]));

/** Changes to followed dossiers that you have not reviewed yet. Derived, never stored. */
export function useAlerts() {
  const all = useAllIntelligence();
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const lastSeen = useWatchStore((s) => s.lastSeen);
  const unfollowed = useWatchStore((s) => s.unfollowed);
  return useMemo(() => {
    if (!hydrated) return [];
    const stale = Object.fromEntries(all.map((d) => [d.notice.id, d.readinessSummary.staleReverificationCount]));
    return deriveAlerts(
      all.map((d) => d.notice),
      lastSeen,
      unfollowed,
      stale,
      SEED_SEEN
    );
  }, [all, hydrated, lastSeen, unfollowed]);
}

const hide = (id: string) => document.getElementById(id)?.hidePopover();

export function AlertsButton({ popoverId = "alerts" }: { popoverId?: string }) {
  const alerts = useAlerts();
  const notices = useNiyomStore((s) => s.notices);
  const markSeen = useWatchStore((s) => s.markSeen);
  const unfollowed = useWatchStore((s) => s.unfollowed);
  const following = notices.length - unfollowed.length;

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        aria-label={alerts.length ? `Alerts, ${alerts.length} new` : "Alerts"}
        className="relative grid h-10 w-10 place-items-center rounded-[var(--r-control)] text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <Bell className={cn("h-[18px] w-[18px]", alerts.length > 0 && "origin-top animate-[bell_900ms_var(--ease-spring)_1]")} />
        {alerts.length > 0 && (
          <span className="num absolute right-1.5 top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-crit px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-ground">
            {alerts.length}
          </span>
        )}
      </button>

      <div
        id={popoverId}
        popover="auto"
        className="pop fixed right-3 top-[calc(var(--bar-h)-6px)] max-h-[calc(100dvh-var(--bar-h)-16px)] w-[min(420px,calc(100vw-24px))] overflow-y-auto rounded-[var(--r-panel)] bg-[#fcfbf8] text-[#1c1b19] shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_24px_60px_-20px_rgba(28,27,25,0.35)] sm:right-6"
      >
        <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-5">
          <p className="text-[19px] font-semibold tracking-[-0.01em]">Changes to notices you follow</p>
          {alerts.length > 1 && (
            <button
              type="button"
              onClick={() => alerts.forEach((a) => markSeen(a.noticeId, a.toVersion))}
              className="flex-none text-[14.5px] italic text-[#6b655b] underline decoration-[#1c1b19]/25 underline-offset-4 hover:text-[#1c1b19]"
            >
              Mark all read
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="px-5 pb-6 text-[16px] leading-relaxed text-[#47433c]">
            You&rsquo;re up to date. When a notice you follow is revised, it shows up here with what it means for your checklist.
          </p>
        ) : (
          <ul className="px-2 pb-2">
            {alerts.map((a) => {
              const n = notices.find((x) => x.id === a.noticeId)!;
              const to = n.versions.find((v) => v.versionNumber === a.toVersion)!;
              const toTag = versionTag(to);
              return (
                <li key={a.noticeId} className="anim-rise rounded-[var(--r-card)] p-3 transition-colors hover:bg-[#1c1b19]/[0.04]">
                  <div className="flex gap-3">
                    <span data-cover={chapterOf(n.id)} className="mt-1 h-10 w-8 flex-none rounded-[5px]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[16.5px] font-semibold leading-snug">
                        {shortTitle(n)} moved to {toTag}
                      </p>
                      <p className="mt-0.5 text-[15px] leading-snug text-[#47433c]">
                        {plural(a.consequential, "change")} that matter{a.consequential === 1 ? "s" : ""}
                        {a.cosmetic ? `, ${a.cosmetic} cosmetic ignored` : ""}.
                        {a.staleChecks > 0 && (
                          <span className="text-[#8a5510]">
                            {" "}
                            {a.staleChecks === 1 ? "One of your checks is" : `${a.staleChecks} of your checks are`} now stale.
                          </span>
                        )}
                      </p>
                      <p className="num mt-0.5 text-[13.5px] italic text-[#6b655b]">Published {formatDate(a.publishedAt)}</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Link
                          href={`/changes/${n.id}?from=${a.fromVersion}&to=${a.toVersion}`}
                          onClick={() => hide(popoverId)}
                          className="inline-flex h-8 items-center rounded-[var(--r-control)] bg-[#1c1b19] px-3 text-[14.5px] font-semibold text-[#f2f1ed] transition-colors hover:bg-[#1c1b19]/85"
                        >
                          See what changed in {toTag}
                        </Link>
                        <button
                          type="button"
                          onClick={() => markSeen(n.id, a.toVersion)}
                          className="inline-flex h-8 items-center rounded-[var(--r-control)] px-3 text-[14.5px] text-[#47433c] transition-colors hover:bg-[#1c1b19]/[0.06]"
                        >
                          Mark as read
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-[#1c1b19]/10 px-5 py-3 text-[14px] italic text-[#6b655b]">
          Following {following} of {notices.length} dossiers. Change this from any dossier&rsquo;s page.
        </p>
      </div>
    </>
  );
}
