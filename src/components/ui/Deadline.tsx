"use client";

import { CalendarPlus } from "lucide-react";
import type { Notice } from "@/domain/types";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { versionOf } from "@/hooks/useDossierIntelligence";
import { daysPhrase, daysUntil, deadlineOf } from "@/lib/deadline";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skel } from "./primitives";

/**
 * "Closes 25 Nov 2026 · 21 days left" with a calendar file from the API.
 * Days are counted only after hydration, so server and client HTML agree.
 */
export function Deadline({ notice, className, compact = false }: { notice: Notice; className?: string; compact?: boolean }) {
  const hydrated = useNiyomStore((s) => s.isHydrated);
  const version = versionOf(notice, notice.activeVersionNumber);
  const d = deadlineOf(version);
  if (!d) return null;
  const days = hydrated ? daysUntil(d.date) : null;
  const urgent = days !== null && days >= 0 && days <= 7;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <p className="text-[16px] leading-snug">
        <span className="text-ink-2">Closes </span>
        <span className="num font-semibold">{formatDate(d.date)}</span>
        <span className="text-ink-3">, </span>
        {days === null ? (
          <Skel className="h-4 w-20 align-middle" />
        ) : (
          <span className={cn("num italic", days < 0 ? "text-crit" : urgent ? "text-warn" : "text-ink-2")}>{daysPhrase(days)}</span>
        )}
      </p>
      <a
        href={`/api/calendar/${notice.id}?version=${version.versionNumber}`}
        download
        className={cn(
          "tap inline-flex items-center gap-1.5 rounded-[var(--r-control)] text-[15px] font-semibold text-ink transition-colors",
          compact ? "underline decoration-ink/30 underline-offset-4 hover:decoration-ink" : "h-9 border border-ink/20 px-3 hover:border-ink/60 hover:bg-ink/[0.04]"
        )}
      >
        <CalendarPlus className="h-4 w-4" /> Add to calendar
      </a>
    </div>
  );
}
