"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** The N's centre line: left stem up, diagonal down, right stem up. */
export const N_PATH = "M11 31V9l18 22V9";

/**
 * The NIYOM mark: an "N" engraved as three parallel strokes, the same rule written
 * three times (v1.0, v1.1, v2.0). The outline is cut with a mask, so it sits on any ground.
 */
export function Mark({ className, draw = false }: { className?: string; draw?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className={cn("flex-none", draw && "logo-draw", className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ["--len" as string]: 80 }}
    >
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <path d={N_PATH} stroke="white" strokeWidth="9.5" />
          <path d={N_PATH} stroke="black" strokeWidth="5.4" />
        </mask>
      </defs>
      <g>
        <path d={N_PATH} stroke="currentColor" strokeWidth="9.5" mask={`url(#m${id})`} />
        <path d={N_PATH} stroke="currentColor" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** Mark + imprint-style wordmark, set like a publisher's colophon. */
export function Logo({ className, draw = false, showMark = true }: { className?: string; draw?: boolean; showMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark && <Mark draw={draw} className="h-8 w-8" />}
      <span className="text-[16px] font-semibold leading-none tracking-[0.16em]">NIYOM</span>
    </span>
  );
}
