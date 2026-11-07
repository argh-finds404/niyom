"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmActionProps {
  /** Label in the resting state (e.g. "Reset the demo"). */
  label: ReactNode;
  /** Label once armed (e.g. "Clear note?"). */
  confirmLabel?: ReactNode;
  /** Runs only on the second click, while armed. */
  onConfirm: () => void;
  /** How long the armed state lasts before it disarms by itself. */
  timeoutMs?: number;
  className?: string;
  armedClassName?: string;
  ariaLabel?: string;
}

/**
 * A two-step button for actions that cannot be undone: the first click arms it (red, with a
 * draining bar), the second within a few seconds confirms. Esc or waiting disarms it.
 */
export function ConfirmAction({
  label,
  confirmLabel = "Confirm?",
  onConfirm,
  timeoutMs = 3200,
  className,
  armedClassName,
  ariaLabel,
}: ConfirmActionProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), timeoutMs);
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setArmed(false);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [armed, timeoutMs]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-[var(--r-control)] px-3 py-1.5 text-[14.5px] transition-colors duration-200",
        armed ? cn("bg-crit font-medium text-ground", armedClassName) : cn("text-ink-2 hover:bg-ink/[0.06] hover:text-ink", className)
      )}
    >
      <span aria-live="polite" className="inline-flex items-center gap-1.5">
        {armed ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {confirmLabel}
          </>
        ) : (
          label
        )}
      </span>
      {armed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] origin-left bg-ground/75"
          style={{ animation: `timer ${timeoutMs}ms linear both` }}
        />
      )}
    </button>
  );
}
