"use client";

import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import type { Notice } from "@/domain/types";
import { compareNoticeVersions } from "@/domain/comparison/compare";
import { isConsequential, versionTag } from "@/lib/format";
import { CHAPTER_COLORS, chapterOf, kindOf } from "@/lib/chapters";
import { FACES, LAYOUT } from "./NoticeFaces";
import { cn } from "@/lib/utils";

const reduceMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The notice as a physical object: each published version is a sheet in a stack, seen in
 * perspective. It deals in on first view, floats, fans out under the pointer, turns as its
 * section scrolls past, and when a newer version becomes active that sheet drops onto the
 * stack and its stamp lands.
 *
 * Scroll motion is decoupled from the hover CSS transition, uses cached layout geometry
 * (zero `getBoundingClientRect()` calls during scroll), and interpolates with frame-rate
 * independent damping before going completely idle.
 */
export function NoticeObject({
  notice,
  className,
  morph = false,
  compact = false,
  float = false,
  scrollTurn = true,
}: {
  notice: Notice;
  className?: string;
  morph?: boolean;
  compact?: boolean;
  float?: boolean;
  scrollTurn?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const scrollStage = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointerRect = useRef<DOMRect | null>(null);
  const activeIdx = Math.max(0, notice.versions.findIndex((v) => v.versionNumber === notice.activeVersionNumber));

  // A newer version becoming active "arrives": its sheet drops onto the stack.
  const [prevIdx, setPrevIdx] = useState(activeIdx);
  const [arrived, setArrived] = useState<string | null>(null);
  if (activeIdx !== prevIdx) {
    setPrevIdx(activeIdx);
    setArrived(activeIdx > prevIdx ? notice.versions[activeIdx].id : null);
  }

  const changed = useMemo(
    () =>
      notice.versions.map((v, i) =>
        i === 0 ? { all: 0, consequential: 0 } : (() => {
          const c = compareNoticeVersions(notice.versions[i - 1], v);
          return { all: c.filter((x) => x.type !== "unchanged").length, consequential: c.filter(isConsequential).length };
        })()
      ),
    [notice.versions]
  );

  // Deal the sheets in the first time the object is actually seen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.seen = "";
        io.disconnect();
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Scroll-linked turn, only while on screen, with cached offsets and smooth damping.
  useEffect(() => {
    const el = root.current;
    const sc = scrollStage.current;
    if (!el || !sc || !scrollTurn || reduceMotion()) return;
    let raf = 0;
    let visible = false;
    let elTop = 0;
    let elHeight = 1;
    let targetP = 0.5;
    let currentP = 0.5;
    let initialized = false;

    const measure = () => {
      const r = el.getBoundingClientRect();
      elTop = r.top + window.scrollY;
      elHeight = Math.max(1, r.height);
    };

    const computeTarget = () => {
      const vh = window.innerHeight;
      const topInView = elTop - window.scrollY;
      return Math.min(1, Math.max(0, (vh - topInView) / (vh + elHeight)));
    };

    const writeTransform = (p: number) => {
      sc.style.setProperty("--sry", `${((p - 0.5) * 26).toFixed(2)}deg`);
      sc.style.setProperty("--sty", `${((0.5 - p) * 36).toFixed(2)}px`);
    };

    const tick = () => {
      raf = 0;
      if (!visible) return;
      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.0008) {
        currentP = targetP;
        writeTransform(currentP);
        return;
      }
      currentP += diff * 0.22;
      writeTransform(currentP);
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (!visible) return;
      targetP = computeTarget();
      if (!initialized) {
        initialized = true;
        currentP = targetP;
        writeTransform(currentP);
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        measure();
        onScroll();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(el);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      io.disconnect();
      ro?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [scrollTurn]);

  const onEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || reduceMotion()) return;
    pointerRect.current = e.currentTarget.getBoundingClientRect();
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !stage.current || reduceMotion()) return;
    const r = pointerRect.current ?? e.currentTarget.getBoundingClientRect();
    stage.current.style.setProperty("--ry", `${(-20 + ((e.clientX - r.left) / r.width - 0.5) * 16).toFixed(2)}deg`);
    stage.current.style.setProperty("--rx", `${(9 - ((e.clientY - r.top) / r.height - 0.5) * 12).toFixed(2)}deg`);
  };
  const onLeave = () => {
    pointerRect.current = null;
    stage.current?.style.removeProperty("--ry");
    stage.current?.style.removeProperty("--rx");
  };

  const kind = kindOf(notice.category);
  const layout = LAYOUT[kind];
  const Face = FACES[kind];
  const colors = CHAPTER_COLORS[chapterOf(notice.id)];
  const activeLabel = versionTag(notice.versions[activeIdx].versionLabel);

  const object = (
    <div
      ref={root}
      data-ui
      className={cn("group/obj relative mx-auto w-full select-none [perspective:1600px]", className)}
      style={{ aspectRatio: layout.aspect }}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="img"
      aria-label={`${notice.title}: ${notice.versions.length} published versions, ${activeLabel} on top`}
    >
      <div className={cn("absolute inset-0", float && "object-float")}>
        <div
          ref={scrollStage}
          className="absolute inset-0 [transform-style:preserve-3d] will-change-transform"
          style={{
            transform: "translate3d(0, var(--sty, 0px), 0) rotateY(var(--sry, 0deg))",
          }}
        >
          <div
            ref={stage}
            className="absolute inset-0 transition-transform duration-[900ms] ease-spring [--fan:1] [transform-style:preserve-3d] group-hover/obj:[--fan:1.55] motion-reduce:transition-none"
            style={{
              transform: "rotateX(var(--rx, 9deg)) rotateY(var(--ry, -20deg)) rotateZ(1.5deg)",
            }}
          >
            {notice.versions.map((v, i) => {
              // Rank 0 is the top of the stack; the active version is always on top.
              const rank = i === activeIdx ? 0 : i < activeIdx ? activeIdx - i : i;
              const dropping = arrived === v.id;
              return (
                <div
                  key={v.id}
                  className="absolute transition-[transform,filter] duration-[900ms] ease-spring [container-type:inline-size] will-change-transform motion-reduce:transition-none"
                  style={{
                    left: layout.left,
                    top: layout.top,
                    width: layout.width,
                    aspectRatio: layout.item,
                    transform: `translate3d(calc(${rank} * ${layout.dx}% * var(--fan)), calc(${rank} * ${layout.dy}% * var(--fan)), ${rank * -46}px) rotateZ(calc(${rank} * -2deg * var(--fan)))`,
                    filter: rank > 0 ? `brightness(${1 - rank * 0.06})` : undefined,
                    zIndex: 10 - rank,
                  }}
                >
                  <div
                    key={dropping ? `${v.id}-drop` : v.id}
                    className={cn("absolute inset-0 rounded-[4px]", dropping ? "sheet-drop" : "sheet-deal")}
                    style={
                      kind === "ticket"
                        ? {
                            animationDelay: dropping ? "0ms" : `${(notice.versions.length - 1 - i) * 130}ms`,
                            filter: "drop-shadow(0 16px 20px rgba(28,27,25,0.24))",
                          }
                        : {
                            animationDelay: dropping ? "0ms" : `${(notice.versions.length - 1 - i) * 130}ms`,
                            boxShadow: "0 18px 22px rgba(28,27,25,0.22), 0 1px 1px rgba(28,27,25,0.12)",
                          }
                    }
                  >
                    <Face
                      notice={notice}
                      version={v}
                      index={i}
                      changed={changed[i].all}
                      consequential={changed[i].consequential}
                      dropping={dropping}
                      colors={colors}
                      compact={compact}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return morph ? (
    <ViewTransition name={`notice-${notice.id}`} share="morph" default="none">
      {object}
    </ViewTransition>
  ) : (
    object
  );
}
