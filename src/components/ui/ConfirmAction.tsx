"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmActionProps {
  /** Label shown in the normal resting state (e.g. "Reset the demo" or "Clear"). */
  label: ReactNode;
  /** Label shown once armed for confirmation (e.g. "Confirm reset?" or "Confirm clear?"). */
  confirmLabel?: ReactNode;
  /** Executed only when the user clicks a second time while armed. */
  onConfirm: () => void;
  /** Milliseconds before the armed state automatically disarms. Defaults to 3200ms. */
  timeoutMs?: number;
  className?: string;
  armedClassName?: string;
  ariaLabel?: string;
}

/**
 * Two-step inline destructive action guard powered by Framer Motion.
 * Protects irreversible operations (resetting demo progress, clearing dossier checks,
 * wiping evidence memos) against accidental single clicks.
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [armed, timeoutMs]);

  return (
    <motion.button
      type="button"
      layout
      aria-label={typeof ariaLabel === "string" ? ariaLabel : undefined}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-[var(--r-control)] px-3 py-1.5 text-[14.5px] transition-colors",
        armed
          ? cn("bg-crit text-ground font-medium shadow-[0_2px_10px_-3px_rgba(168,42,33,0.45)]", armedClassName)
          : cn("text-ink-2 hover:bg-ink/[0.06] hover:text-ink", className)
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {armed ? (
          <motion.span
            key="armed"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{confirmLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-1.5"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {armed && (
        <motion.span
          aria-hidden
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: timeoutMs / 1000, ease: "linear" }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] origin-left bg-ground/75"
        />
      )}
    </motion.button>
  );
}

