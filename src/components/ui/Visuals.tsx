"use client";

import { useMemo } from "react";
import type { Notice } from "@/domain/types";
import { compareNoticeVersions } from "@/domain/comparison/compare";
import { formatDate, isConsequential, versionTag } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Readiness as the papers themselves: one small sheet per required item. A checked paper is solid,
 * a stale one amber, a missing one an outline. Hover a sheet for its name.
 */
export function PaperRow({
  items,
  className,
  size = 1,
}: {
  items: { id: string; title: string; status: "completed" | "needs_reverification" | "pending" }[];
  className?: string;
  size?: number;
}) {
  const done = items.filter((i) => i.status === "completed").length;
  return (
    <ul role="img" aria-label={`${done} of ${items.length} required papers ready`} className={cn("flex flex-wrap gap-[5px]", className)}>
      {items.map((i, k) => (
        <li key={i.id} title={`${i.title}: ${i.status === "completed" ? "ready" : i.status === "needs_reverification" ? "changed, check again" : "not ready yet"}`}>
          <svg
            viewBox="0 0 16 20"
            width={16 * size}
            height={20 * size}
            aria-hidden
            className="paper-pop block"
            style={{ animationDelay: `${k * 45}ms`, color: i.status === "needs_reverification" ? "var(--warn)" : "currentColor" }}
          >
            <path
              d="M1.5 1.5h8.5l4.5 4.5v12.5h-13z"
              fill={i.status === "pending" ? "none" : "currentColor"}
              fillOpacity={i.status === "pending" ? 0 : 0.92}
              stroke="currentColor"
              strokeOpacity={i.status === "pending" ? 0.55 : 1}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M10 1.5v4.5h4.5" fill="none" stroke={i.status === "pending" ? "currentColor" : "var(--ground)"} strokeOpacity="0.55" strokeWidth="1.1" />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/**
 * A notice's history as a line: one node per published version. Solid nodes changed something
 * that matters, hollow ones only cosmetic text; the version your checklist follows is ringed.
 */
export function VersionTrack({ notice, className, showDates = true }: { notice: Notice; className?: string; showDates?: boolean }) {
  const steps = useMemo(
    () =>
      notice.versions.map((v, i) => ({
        v,
        matter: i === 0 ? 0 : compareNoticeVersions(notice.versions[i - 1], v).filter(isConsequential).length,
      })),
    [notice.versions]
  );
  return (
    <ol
      aria-label={`Published versions: ${steps.map((s) => `${versionTag(s.v)}${s.matter ? `, ${s.matter} changes that matter` : ""}`).join("; ")}`}
      className={cn("relative grid", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {/* The line runs from the first node's centre to the last one's. */}
      <span aria-hidden className="absolute left-[7px] top-[7px] h-px bg-current opacity-25" style={{ right: `calc(100% / ${steps.length} - 7px)` }} />
      {steps.map(({ v, matter }, i) => {
        const active = v.versionNumber === notice.activeVersionNumber;
        return (
          <li key={v.id} className="relative min-w-0 pr-2">
            <span
              aria-hidden
              className={cn(
                "relative block h-[15px] w-[15px] rounded-full border-2 border-current transition-transform duration-500",
                i === 0 || matter ? "bg-current" : "bg-transparent",
                active && "scale-110 shadow-[0_0_0_4px_color-mix(in_srgb,currentColor_22%,transparent)]"
              )}
            />
            <span className={cn("code mt-2 block text-[14.5px]", active ? "opacity-100" : "opacity-70")}>{versionTag(v)}</span>
            {showDates && <span className="num block text-[13px] italic opacity-60">{formatDate(v.publishedAt)}</span>}
            {i > 0 && (
              <span className="block truncate text-[13px] italic opacity-75">{matter ? `${matter} that matter${matter === 1 ? "s" : ""}` : "cosmetic"}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
