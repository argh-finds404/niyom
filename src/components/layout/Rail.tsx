"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useUiStore } from "@/hooks/useUiStore";
import { cn } from "@/lib/utils";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const TICK = 13; // resting tick width, px

interface SectionMetric {
  top: number;
  height: number;
}

interface CoverBandMetric {
  top: number;
  bottom: number;
  ink: string;
}

/**
 * The page rail, after the reference: one tick per section of the page you are reading.
 * Sections opt in with `data-rail="Label"`.
 *  - a single indicator slides to the section under the reading line and grows as you read it;
 *  - ticks swell under the pointer like a dock;
 *  - hovering the rail fans out every section's title as a contents list;
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
  const maxScroll = useRef<number>(0);
  const activeRef = useRef<number>(0);
  const lastProgress = useRef<number>(-1);
  const lastInk = useRef<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

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
      const coverEls = [...document.querySelectorAll<HTMLElement>("#main section[data-cover], #main [data-rail][data-cover]")].filter(
        (e) => e.getClientRects().length > 0
      );
      covers.current = coverEls.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top + sy,
          bottom: r.bottom + sy,
          ink: getComputedStyle(el).color,
        };
      });
      baseInk.current = getComputedStyle(document.documentElement).color;
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
      }

      const nav = rail.current;
      if (nav) {
        const mid = sy + vh * 0.5;
        let nextInk = baseInk.current;
        for (let i = 0; i < covers.current.length; i++) {
          const c = covers.current[i];
          if (mid >= c.top && mid <= c.bottom) {
            nextInk = c.ink;
            break;
          }
        }
        if (nextInk && nextInk !== lastInk.current) {
          lastInk.current = nextInk;
          nav.style.setProperty("--rail-ink", nextInk);
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
    // The tick's centre, measured from the top of the list (each <li> is the button's offset parent).
    ind.style.transform = `translate3d(-50%, ${li.offsetTop + b.offsetHeight / 2 - 1}px, 0)`;
    ind.style.opacity = "1";
  }, [active, labels]);

  // Cache tick centres on pointer enter so pointermove never forces layout reads.
  const cacheTickCenters = () => {
    tickCenters.current = ticks.current.map((t) => {
      if (!t) return 0;
      const box = t.getBoundingClientRect();
      return box.top + box.height / 2;
    });
  };

  // Dock-style swell under the pointer.
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || reduced()) return;
    if (tickCenters.current.length !== ticks.current.length) cacheTickCenters();
    ticks.current.forEach((t, i) => {
      if (!t) return;
      const center = tickCenters.current[i] ?? 0;
      const d = Math.abs(e.clientY - center);
      const k = Math.max(0, 1 - d / 64);
      t.style.width = `${TICK + 9 * k}px`;
      t.style.opacity = String(0.32 + 0.5 * k);
    });
  };
  const onLeave = () => {
    setOpen(false);
    ticks.current.forEach((t) => {
      if (!t) return;
      t.style.width = "";
      t.style.opacity = "";
    });
  };

  const jump = (i: number) => {
    els.current[i]?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    setOpen(false);
  };

  return (
    <nav
      ref={rail}
      aria-label="Sections on this page"
      onPointerLeave={onLeave}
      className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] sm:flex flex-col items-center pt-[var(--bar-h)] text-[var(--rail-ink,var(--ink))] transition-colors duration-500 print:hidden"
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        {pathname !== "/" && (
          <button
            type="button"
            onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
            aria-label="Back"
            className="pointer-events-auto mb-4 hidden h-9 w-9 place-items-center rounded-[var(--r-control)] transition-[background-color,transform] duration-300 hover:-translate-x-0.5 hover:bg-current/[0.08] lg:grid"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
        )}

        <div
          className="pointer-events-auto relative"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") {
              cacheTickCenters();
              setOpen(true);
            }
          }}
          onPointerMove={onMove}
          onFocus={() => setOpen(true)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
        >
          {/* The contents list that fans out on hover, as in the reference. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -inset-y-3 left-[calc(100%-4px)] hidden w-max min-w-[220px] rounded-[var(--r-card)] bg-[#fcfbf8]/96 shadow-[0_0_0_1px_rgba(28,27,25,0.07),0_24px_50px_-24px_rgba(28,27,25,0.45)] transition-[opacity,transform] duration-300 ease-out sm:block",
              open && labels.length ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
            )}
          />
          <span
            ref={indicator}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-[2.5px] w-[calc(15px_+_11px*var(--p,0))] rounded-full bg-current opacity-0 transition-[transform,opacity] duration-[650ms] ease-spring will-change-transform motion-reduce:transition-none"
          />
          <ol key={pathname} className="relative flex flex-col items-center">
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
                    aria-label={label}
                    aria-current={on ? "location" : undefined}
                    className="group flex h-[22px] w-[var(--rail-w)] items-center justify-center lg:h-[26px] pointer-coarse:h-[34px]"
                  >
                    <span
                      ref={(el) => {
                        ticks.current[i] = el;
                      }}
                      aria-hidden
                      className="tick-in block h-[2px] rounded-full bg-current opacity-[0.32] transition-[width,opacity] duration-300 ease-out"
                      style={{ width: TICK, animationDelay: `${160 + i * 55}ms` }}
                    />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => jump(i)}
                    className={cn(
                      "absolute left-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap py-0.5 pr-4 text-left text-[15px] leading-tight text-[#1c1b19] transition-[opacity,transform] duration-300 ease-out sm:block",
                      on ? "font-semibold" : "text-[#47433c] hover:text-[#1c1b19]",
                      open ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-1.5 opacity-0"
                    )}
                    style={{ transitionDelay: open ? `${i * 30}ms` : "0ms" }}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="pointer-events-auto mb-4 hidden lg:block">
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
