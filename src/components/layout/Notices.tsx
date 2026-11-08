"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AlertTriangle, Check, WifiOff, X } from "lucide-react";
import { useUiStore, type Toast, type ToastTone } from "@/hooks/useUiStore";
import { STORAGE_ERROR_EVENT } from "@/data/persistence/db";
import { Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

/* The app icon of each banner: NIYOM's mark for news, a symbol on a tinted tile for outcomes. */
const ICON: Record<ToastTone, { tile: string; glyph: ReactNode }> = {
  neutral: { tile: "bg-[#1c1b19] text-[#f4f1ea]", glyph: <Mark className="h-[22px] w-[22px]" /> },
  ok: { tile: "bg-[#2d6a47] text-white", glyph: <Check strokeWidth={2.6} className="h-[18px] w-[18px]" /> },
  warn: { tile: "bg-[#b07a1c] text-white", glyph: <AlertTriangle strokeWidth={2.2} className="h-[17px] w-[17px]" /> },
  crit: { tile: "bg-[#9a2b1e] text-white", glyph: <AlertTriangle strokeWidth={2.2} className="h-[17px] w-[17px]" /> },
};

function Icon({ tile, children }: { tile: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn("grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.18)]", tile)}
    >
      {children}
    </span>
  );
}

/** How far a banner must travel (px) before letting go dismisses it. */
const SWIPE_UP = 36;
const SWIPE_SIDE = 90;

/**
 * One notification. Drag it up (or sideways) to dismiss; it follows the finger and springs back
 * if released early. Hovering, focusing or holding it pauses its timer.
 */
function Banner({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const { tile, glyph } = ICON[toast.tone];

  const move = (dx: number, dy: number) => {
    const el = ref.current;
    if (!el) return;
    const y = dy < 0 ? dy : dy * 0.18; // pulling down only stretches a little
    el.style.transform = `translate3d(${dx}px, ${y}px, 0)`;
    el.style.opacity = String(1 - Math.min(0.7, (Math.abs(dx) + Math.max(0, -dy) * 2) / 260));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = "";
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    move(d.dx, d.dy);
  };
  const onPointerEnd = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    delete el.dataset.dragging;
    if (d.dy < -SWIPE_UP || Math.abs(d.dx) > SWIPE_SIDE) {
      // Carry on in the direction of the swipe instead of playing the standard exit.
      el.style.animation = "none";
      el.style.transform = Math.abs(d.dx) > SWIPE_SIDE ? `translate3d(${Math.sign(d.dx) * 120}%, 0, 0)` : "translate3d(0, -140%, 0)";
      el.style.opacity = "0";
      onDismiss(toast.id);
    } else {
      el.style.transform = "";
      el.style.opacity = "";
    }
  };

  return (
    <li className={cn("banner-slot mb-2")} data-leaving={toast.leaving ? "" : undefined}>
      <div className="min-h-0">
        <div
          ref={ref}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className={cn(
            "banner pointer-events-auto relative flex cursor-grab select-none items-start gap-3 rounded-[22px] p-3 pr-2.5 active:cursor-grabbing",
            toast.leaving ? "banner-leave" : "banner-enter"
          )}
        >
          <Icon tile={tile}>{glyph}</Icon>
          <div className="min-w-0 flex-1 pt-px">
            <p className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[15px] font-semibold leading-[20px]">{toast.title}</span>
              <span className="flex-none text-[13px] leading-[20px] text-[#1c1b19]/50">now</span>
            </p>
            {toast.body && <p className="mt-0.5 text-[14.5px] leading-[19px] text-[#1c1b19]/72">{toast.body}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="banner-close -my-0.5 grid h-7 w-7 flex-none place-items-center rounded-full text-[#1c1b19]/55 hover:bg-[#1c1b19]/[0.07] hover:text-[#1c1b19]"
          >
            <X strokeWidth={2.4} className="h-3.5 w-3.5" />
          </button>
          <span aria-hidden onAnimationEnd={() => onDismiss(toast.id)} className="banner-clock pointer-events-none absolute h-px w-px opacity-0" />
        </div>
      </div>
    </li>
  );
}

/**
 * Notifications, styled like a system banner: they drop in under the top bar (centred on phones,
 * at the right on larger screens), newest first. "You're offline" stays pinned until the connection returns.
 */
export function Notices() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  const toast = useUiStore((s) => s.toast);
  const [offline, setOffline] = useState(false);
  const storageWarned = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffline(!navigator.onLine));
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      toast({ tone: "ok", title: "Back online", body: "Nothing was lost. NIYOM kept working on this device." });
    };
    const storageFailed = () => {
      if (storageWarned.current) return;
      storageWarned.current = true;
      toast({
        tone: "crit",
        title: "Couldn't save to this device",
        body: "Browser storage is blocked or full. Your changes will last until you close this tab.",
      });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener(STORAGE_ERROR_EVENT, storageFailed);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener(STORAGE_ERROR_EVENT, storageFailed);
    };
  }, [toast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--bar-h)+8px)] z-[60] flex justify-center px-2 sm:justify-end sm:px-4 lg:px-6 print:hidden">
      <div className="w-full max-w-[420px] sm:w-[370px]">
        <div aria-live="assertive">
          {offline && (
            <div className="banner-slot mb-2">
              <div className="min-h-0">
                <div className="banner banner-enter pointer-events-auto flex items-start gap-3 rounded-[22px] p-3 pr-4">
                  <Icon tile="bg-[#1c1b19] text-[#f4f1ea]">
                    <WifiOff strokeWidth={2.2} className="h-[17px] w-[17px]" />
                  </Icon>
                  <div className="min-w-0 flex-1 pt-px">
                    <p className="text-[15px] font-semibold leading-[20px]">You&rsquo;re offline</p>
                    <p className="mt-0.5 text-[14.5px] leading-[19px] text-[#1c1b19]/72">
                      Every dossier is on this device. Checks and profile edits keep working and are sent when you reconnect.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <ol aria-live="polite">
          {[...toasts].reverse().map((t) => (
            <Banner key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </div>
  );
}
