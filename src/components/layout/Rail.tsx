"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useUiStore } from "@/hooks/useUiStore";
import { cn } from "@/lib/utils";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const TICK = 46; // full tick length, px; ticks rest at a fraction of it and swell around where you are
const REST = 0.4;

interface SectionMetric {
  top: number;
  height: number;
}

interface CoverBandMetric {
  top: number;
  bottom: number;
  ink: string;
  bg: string;
}

/**
 * The page rail, after the Stripe Press reference: one long tick per section of the page.
 * Sections opt in with `data-rail="Label"`.
 *  - the ticks swell around where you are reading, so the column breathes as you scroll;
 *  - under the pointer they swell around the pointer instead, like a dock;
 *  - the current section's line is bold, and its name appears beside it when you enter it,
 *    or beside whichever line you point at;
 *  - the rail takes the ink colour of whatever lies beneath it.
 *
 * Scroll and pointer motion run against cached geometry in an animation-frame loop with zero
 * synchronous layout reads (`getBoundingClientRect` / `elementFromPoint` / `getComputedStyle`)
 * during scroll frames.
 */
export function Rail() {
  const pathname = usePathname();
  const router = useRouter();
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const rail = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const ticks = useRef<(HTMLSpanElement | null)[]>([]);
  const tickCenters = useRef<number[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const els = useRef<HTMLElement[]>([]);
  const metrics = useRef<SectionMetric[]>([]);
  const covers = useRef<CoverBandMetric[]>([]);
  const baseInk = useRef<string>("");
  const baseBg = useRef<string>("");
  const maxScroll = useRef<number>(0);
  const activeRef = useRef<number>(0);
  const lastProgress = useRef<number>(-1);
  const lastInk = useRef<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const pointerIn = useRef(false);
  const [bg, setBg] = useState("");

  /** Lengthen the ticks around a position (in ticks; 2.5 is the middle of the third), on the compositor. */
  const swell = (at: number) => {
    ticks.current.forEach((t, i) => {
      if (!t) return;
      const d = i + 0.5 - at;
      const k = Math.exp(-(d * d) / 1.7);
      t.style.transform = `scaleX(${(REST + (1 - REST) * k).toFixed(3)})`;
      t.style.opacity = (0.3 + 0.6 * k).toFixed(3);
    });
  };

  // Discover sections. Next keeps visited pages mounted but hidden, so count only what is rendered.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    let t = 0;
    const scan = () => {
      els.current = [...document.querySelectorAll<HTMLElement>("[data-rail]")].filter((e) => e.getClientRects().length > 0);
      const next = els.current.map((e) => e.dataset.rail ?? "");
      setLabels((prev) => (prev.length === next.length && prev.every((l, i) => l === next[i]) ? prev : next));
    };
    scan();
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(scan, 150);
    });
    mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
    return () => {
      mo.disconnect();
      clearTimeout(t);
    };
  }, [pathname]);

  // Cache section offsets and cover-band colours on layout/resize; follow scroll with pure arithmetic.
  useEffect(() => {
    let raf = 0;

    const measure = () => {
      const sy = window.scrollY;
      metrics.current = els.current.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + sy, height: Math.max(1, r.height) };
      });
      const coverEls = [...document.querySelectorAll<HTMLElement>("#main section[data-cover], #main [data-rail][data-cover], footer")].filter(
        (e) => e.getClientRects().length > 0
      );
      covers.current = coverEls.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { top: r.top + sy, bottom: r.bottom + sy, ink: cs.color, bg: cs.backgroundColor };
      });
      baseInk.current = getComputedStyle(document.documentElement).color;
      baseBg.current = getComputedStyle(document.body).backgroundColor;
      maxScroll.current = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    const update = () => {
      raf = 0;
      const mList = metrics.current;
      if (!mList.length) return;
      const sy = window.scrollY;
      const vh = window.innerHeight;
      const line = sy + vh * 0.42;

      let idx = 0;
      for (let i = 0; i < mList.length; i++) {
        if (mList[i].top <= line) idx = i;
      }
      const atEnd = sy >= maxScroll.current - 4;
      if (atEnd) idx = mList.length - 1;

      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }

      const cur = mList[idx];
      const progress = atEnd ? 1 : Math.min(1, Math.max(0, (line - cur.top) / cur.height));
      if (Math.abs(progress - lastProgress.current) >= 0.004) {
        lastProgress.current = progress;
        indicator.current?.style.setProperty("--p", progress.toFixed(3));
        // The ticks swell around the reading position; it travels down the column as you scroll.
        if (!pointerIn.current) swell(idx + progress);
      }

      const nav = rail.current;
      if (nav) {
        const mid = sy + vh * 0.5;
        let nextInk = baseInk.current;
        let nextBg = baseBg.current;
        for (let i = 0; i < covers.current.length; i++) {
          const c = covers.current[i];
          if (mid >= c.top && mid <= c.bottom) {
            nextInk = c.ink;
            nextBg = c.bg;
            break;
          }
        }
        if (nextInk && nextInk !== lastInk.current) {
          lastInk.current = nextInk;
          nav.style.setProperty("--rail-ink", nextInk);
          setBg(nextBg);
        }
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();

    const main = document.getElementById("main");
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro && main) ro.observe(main);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [labels]);

  // Slide the indicator to the active tick on the GPU compositor.
  useEffect(() => {
    const b = buttons.current[active];
    const ind = indicator.current;
    const li = b?.parentElement;
    if (!b || !ind || !li) return;
    ind.style.transform = `translate3d(0, ${li.offsetTop + b.offsetHeight / 2 - 1.5}px, 0)`;
    ind.style.opacity = "1";
    // The first scroll pass runs before the ticks exist; swell them once they do.
    if (!pointerIn.current) swell(active + Math.max(0, lastProgress.current));
  }, [active, labels]);

  // Entering a section shows its name beside its line for a moment.
  useEffect(() => {
    if (!labels.length) return;
    const show = window.setTimeout(() => setFlash(true), 0);
    const hide = window.setTimeout(() => setFlash(false), 1900);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [active, labels.length]);

  // Cache tick centres on pointer enter so pointermove never forces layout reads.
  const cacheTickCenters = () => {
    tickCenters.current = ticks.current.map((t) => {
      if (!t) return 0;
      const box = t.getBoundingClientRect();
      return box.top + box.height / 2;
    });
  };

  // Under the pointer the swell follows the pointer, and the nearest line shows its name.
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (tickCenters.current.length !== ticks.current.length) cacheTickCenters();
    const c = tickCenters.current;
    if (!c.length) return;
    let near = 0;
    for (let i = 1; i < c.length; i++) if (Math.abs(e.clientY - c[i]) < Math.abs(e.clientY - c[near])) near = i;
    if (near !== hover) setHover(near);
    if (reduced()) return;
    const step = c.length > 1 ? (c[c.length - 1] - c[0]) / (c.length - 1) : 1;
    swell((e.clientY - c[0]) / step + 0.5);
  };
  const onLeave = () => {
    pointerIn.current = false;
    setHover(null);
    swell(activeRef.current + Math.max(0, lastProgress.current));
  };

  const jump = (i: number) => {
    els.current[i]?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  const named = hover ?? (flash ? active : null);

  return (
    <nav
      ref={rail}
      aria-label="Sections on this page"
      onPointerLeave={onLeave}
      className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] sm:flex flex-col pt-[var(--bar-h)] text-[var(--rail-ink,var(--ink))] transition-colors duration-500 print:hidden"
    >
      <div className="flex flex-1 flex-col justify-center pl-[9px] lg:pl-[12px]">
        {pathname !== "/" && (
          <button
            type="button"
            onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
            aria-label="Back"
            className="pointer-events-auto mb-5 hidden h-9 w-9 -translate-x-1.5 place-items-center rounded-[var(--r-control)] transition-[background-color,transform] duration-300 hover:-translate-x-2.5 hover:bg-current/[0.08] lg:grid"
          >
            <ArrowLeft className="h-[20px] w-[20px]" />
          </button>
        )}

        <div
          className="pointer-events-auto relative w-max"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") {
              pointerIn.current = true;
              cacheTickCenters();
            }
          }}
          onPointerMove={onMove}
          onFocus={() => setFlash(true)}
        >
          <span
            ref={indicator}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 h-[3px] w-[calc(30px_+_16px*var(--p,0))] rounded-full bg-current opacity-0 transition-[transform,opacity] duration-[650ms] ease-spring will-change-transform motion-reduce:transition-none"
          />
          <ol key={pathname} className="relative flex flex-col">
            {labels.map((label, i) => {
              const on = i === active;
              return (
                <li key={`${label}-${i}`} className="relative">
                  <button
                    ref={(el) => {
                      buttons.current[i] = el;
                    }}
                    type="button"
                    onClick={() => jump(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={label}
                    aria-current={on ? "location" : undefined}
                    className="group flex h-[17px] items-center lg:h-[19px] pointer-coarse:h-[30px]"
                    style={{ width: TICK + 4 }}
                  >
                    <span
                      ref={(el) => {
                        ticks.current[i] = el;
                      }}
                      aria-hidden
                      className={cn(
                        "tick-in block h-[2px] origin-left rounded-full bg-current transition-[transform,opacity] duration-500 ease-spring",
                        on && "h-[2.5px]"
                      )}
                      style={{ width: TICK, transform: `scaleX(${REST})`, opacity: 0.3, animationDelay: `${160 + i * 45}ms` }}
                    />
                  </button>
                  {/* Its name, beside its line: when you point at it, or for a moment after you enter it. */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[16px] font-semibold leading-tight transition-[opacity,transform] duration-300 ease-out",
                      named === i ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0"
                    )}
                    style={{ background: bg ? `color-mix(in srgb, ${bg} 88%, transparent)` : undefined }}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="pointer-events-auto mb-4 hidden pl-[12px] lg:block">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="How NIYOM works"
          className="grid h-10 w-10 place-items-center rounded-[var(--r-control)] text-[22px] italic transition-colors hover:bg-current/[0.08]"
        >
          ?
        </button>
      </div>
    </nav>
  );
}
