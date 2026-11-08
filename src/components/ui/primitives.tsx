"use client";

import Link from "next/link";
import { flushSync } from "react-dom";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessItemStatus } from "@/domain/types";

/* ───────────────────────── Motion helper ───────────────────────── */

/**
 * Runs a store update inside the browser's View Transition so items glide to their new
 * place (e.g. a re-verified item moving from "stale" to "ready"). Falls back to a plain update.
 */
type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };

export function withViewTransition(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!d.startViewTransition || document.visibilityState !== "visible" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  try {
    const t = d.startViewTransition(() => flushSync(update));
    // The browser skips a transition if the viewport resizes or another one starts; the update
    // itself still runs, so a skipped animation is not an error.
    const ignore = () => {};
    t.ready.catch(ignore);
    t.finished.catch(ignore);
    t.updateCallbackDone.catch(ignore);
  } catch {
    update();
  }
}

/* ───────────────────────── Stamp ───────────────────────── */

export type Tone = "ok" | "warn" | "crit" | "plain" | "ink";

const STAMP: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/14 text-warn",
  crit: "bg-crit/12 text-crit",
  plain: "bg-ink/[0.07] text-ink-2",
  ink: "bg-ink text-ground",
};

/** A small-caps status mark, cut square. */
export function Stamp({ tone = "plain", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "code inline-flex flex-none items-center whitespace-nowrap rounded-[var(--r-mark)] px-2 py-px text-[14px] leading-[1.45]",
        STAMP[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ───────────────────────── Buttons ───────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "warn";

const VARIANT: Record<Variant, string> = {
  primary: "border-ink bg-ink text-ground hover:bg-ink/88",
  secondary: "border-ink/25 bg-transparent text-ink hover:border-ink/60 hover:bg-ink/[0.04]",
  ghost: "border-transparent bg-transparent text-ink hover:bg-ink/[0.06]",
  warn: "border-warn bg-warn text-paper hover:bg-warn/90",
};

export function buttonClass(variant: Variant = "secondary", size: "sm" | "md" = "md", className?: string) {
  return cn(
    "inline-flex flex-none select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-control)] border font-semibold",
    "transition-[background-color,color,transform] duration-200 ease-out active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-55",
    size === "sm" ? "h-9 px-3 text-[15px]" : "h-11 px-4 text-[16px]",
    VARIANT[variant],
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

/* ───────────────────────── Action rows (Stripe Press style) ───────────────────────── */

type RowProps = { label: ReactNode; meta?: ReactNode; tone?: "ink" | "warn"; className?: string };

function RowInner({ label, meta, tone = "ink" }: RowProps) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 px-4 py-3">
        <span className={cn("font-semibold", tone === "warn" && "text-warn")}>{label}</span>
        {meta && <span className="num text-[15px] font-normal text-ink-3">{meta}</span>}
      </span>
      <span
        aria-hidden
        className={cn("grid w-12 flex-none place-items-center border-l", tone === "warn" ? "border-warn/30 text-warn" : "border-ink/15")}
      >
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </>
  );
}

const rowClass = (tone: "ink" | "warn" = "ink", className?: string) =>
  cn(
    "group relative flex w-full items-stretch text-left text-[16px] transition-colors duration-200",
    tone === "warn" ? "bg-warn/[0.07] hover:bg-warn/[0.12]" : "hover:bg-ink/[0.045]",
    className
  );

export function ActionRowLink({
  href,
  label,
  meta,
  tone,
  className,
  ...rest
}: RowProps & Omit<ComponentProps<typeof Link>, "className">) {
  return (
    <Link href={href} className={rowClass(tone, className)} {...rest}>
      <RowInner label={label} meta={meta} tone={tone} />
    </Link>
  );
}

/** Groups rows into one softly rounded block with light dividers. */
export function ActionRows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col divide-y divide-ink/12 overflow-hidden rounded-[var(--r-card)] border border-ink/22", className)}>
      {children}
    </div>
  );
}

/* ───────────────────────── Typography ───────────────────────── */

/** "——— Author": the reference's italic section label with a leading rule. */
export function Label({
  children,
  id,
  as: Tag = "h2",
  meta,
  className,
}: {
  children: ReactNode;
  id?: string;
  as?: "h2" | "h3" | "p";
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1", className)}>
      <Tag id={id} className="flex items-center gap-4 text-[21px] font-medium italic leading-tight tracking-[-0.005em]">
        <span aria-hidden className="h-px w-10 flex-none bg-ink/60" />
        {children}
      </Tag>
      {meta && <span className="text-[15px] italic text-ink-3">{meta}</span>}
    </div>
  );
}

/* ───────────────────────── Loading ───────────────────────── */

export function Skel({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton", className)} />;
}

/* ───────────────────────── Numbers ───────────────────────── */

/** Tweens to a new value so a change in readiness is seen, not just read. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = b;
      raf = requestAnimationFrame(() => setShown(b));
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 750);
      const v = Math.round(a + (b - a) * (1 - Math.pow(1 - p, 3)));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={cn("num", className)}>{shown}</span>;
}

export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-[5px] w-full overflow-hidden rounded-full bg-ink/10", className)}
    >
      <div
        className="h-full w-full origin-left rounded-full bg-ink transition-transform duration-[900ms] ease-spring"
        style={{ transform: `scaleX(${value / 100})` }}
      />
    </div>
  );
}

/* ───────────────────────── Readiness check ───────────────────────── */

export function Check({
  status,
  disabled,
  loading,
  label,
  onToggle,
}: {
  status: ReadinessItemStatus;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (loading) return <Skel className="h-6 w-6" />;
  const stale = status === "needs_reverification";
  const done = status === "completed";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={stale ? "mixed" : done}
      aria-label={stale ? `${label}: stale, re-verify against the current version` : label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "tap relative grid h-6 w-6 flex-none place-items-center rounded-[6px] border-[1.5px] transition-[background-color,border-color,transform] duration-200 ease-out active:scale-90",
        done && "border-ink bg-ink text-ground",
        stale && "border-warn bg-warn/10 text-warn",
        !done && !stale && "border-ink/55 hover:border-ink hover:bg-ink/[0.05]",
        disabled && "cursor-not-allowed border-dashed border-ink/35 bg-transparent hover:bg-transparent"
      )}
    >
      {done && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="check-draw" />
        </svg>
      )}
      {stale && <span className="text-[15px] font-bold italic leading-none">!</span>}
    </button>
  );
}

/* ───────────────────────── Overlay (native dialog, animated both ways) ───────────────────────── */

let activeOverlayLocks = 0;

export function Overlay({
  open,
  onClose,
  label,
  placement,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  placement: "center" | "right" | "top";
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  // Keep the last content on screen while the exit animation plays.
  const [kept, setKept] = useState<ReactNode>(null);
  if (open && kept !== children) setKept(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
        // Land on the panel, not on its first button, so nothing looks pre-selected.
        el.focus();
      }
      return;
    }
    if (!el.open) return;
    const start = requestAnimationFrame(() => setClosing(true));
    const t = setTimeout(() => {
      el.close();
      setClosing(false);
      setKept(null);
    }, 240);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    activeOverlayLocks += 1;
    document.documentElement.style.overflow = "hidden";
    return () => {
      activeOverlayLocks = Math.max(0, activeOverlayLocks - 1);
      if (activeOverlayLocks === 0) {
        document.documentElement.style.overflow = "";
      }
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      data-closing={closing ? "" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-0 max-h-none max-w-none overflow-visible bg-transparent p-0 text-ink outline-none",
        placement === "right" ? "left-auto right-0 h-full w-full sm:w-[500px]" : "h-full w-full",
        className
      )}
    >
      {open ? children : kept}
    </dialog>
  );
}
