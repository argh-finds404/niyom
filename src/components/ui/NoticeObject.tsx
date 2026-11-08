"use client";

import { useEffect, useMemo, useRef, useState, ViewTransition, type CSSProperties } from "react";
import type { Notice, NoticeVersion } from "@/domain/types";
import { compareNoticeVersions } from "@/domain/comparison/compare";
import { isConsequential, versionPhrase, versionTag } from "@/lib/format";
import { CHAPTER_COLORS, chapterOf, kindOf, type ObjectKind } from "@/lib/chapters";
import { useDossierIntelligence } from "@/hooks/useDossierIntelligence";
import { formatDate, plural } from "@/lib/format";
import { FACES, LAYOUT } from "./NoticeFaces";
import { cn } from "@/lib/utils";

/*
 * Opening like a book. The top sheet is a cover hinged on its spine: portrait objects (circular,
 * passport) open sideways, landscape ones (ticket, code window) flip up like a pad. Behind the
 * cover lies a page with your checklist for that version. Three printed pages riffle over after the cover;
 * the last lands on top as the facing page, with the version on it.
 * The whole spread slides and scales so it stays centred in the object's box.
 */
function bookGeometry(kind: ObjectKind) {
  const l = LAYOUT[kind];
  const w = parseFloat(l.width);
  const [ia, ib] = l.item.split("/").map(Number);
  const [, ah] = l.aspect.split("/").map(Number);
  if (kind === "ticket" || kind === "code") {
    const h = (((w / 100) * (ib / ia)) / ah) * 100; // sheet height, as % of the box height
    const fit = Math.min(1, 100 / (2 * h));
    return { sideways: false, shiftX: 0, shiftY: (50 - parseFloat(l.top)) * fit, fit };
  }
  // Scaling happens around the box's centre, so the move that centres the spread shrinks with it.
  const fit = Math.min(1, 100 / (2 * w));
  return { sideways: true, shiftX: (50 - parseFloat(l.left)) * fit, shiftY: 0, fit };
}

const PAPER = "#fcfbf8";
const LEAVES = [0, 1, 2];
const edges = (dx: number, dy: number) =>
  [1, 2, 3, 4, 5].map((n) => `${dx * n}px ${dy * n}px 0 ${n % 2 ? "#e6e0d3" : "#f8f6f0"}`).join(", ");
/** The shade where a page bends into the spine. */
function Gutter({ side }: { side: "left" | "right" | "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[4px]"
      style={{ background: `linear-gradient(to ${side}, rgba(28,27,25,0.13), rgba(28,27,25,0.03) 7%, rgba(28,27,25,0) 12%)` }}
    />
  );
}
const INK = "#1c1b19";
const MUTED = "#6b655b";

/** The cover's back: which version this is and what it changed. */
function InsidePage({ notice, index, consequential, colors, wide }: { notice: Notice; index: number; consequential: number; colors: { cover: string }; wide: boolean }) {
  const v = notice.versions[index];
  const k = wide ? 0.66 : 1;
  return (
    <div className="flex h-full flex-col rounded-[4px] p-[7cqw]" style={{ background: PAPER, color: INK, fontSize: `${4.6 * k}cqw` }}>
      <span className="h-[1.2cqw] w-[14cqw] rounded-full" style={{ background: colors.cover }} />
      <p className="mt-[5cqw] italic" style={{ color: MUTED }}>
        {notice.departmentOrTrust}
      </p>
      <p className="display mt-[3cqw] leading-none" style={{ fontSize: `${11 * k}cqw` }}>
        {versionTag(v)}
      </p>
      <p className="mt-[2cqw] font-semibold">{v.versionLabel.split(" ").slice(1).join(" ")}</p>
      <p className="mt-[1cqw] italic" style={{ color: MUTED }}>
        Published {formatDate(v.publishedAt)}
      </p>
      <p className="mt-auto leading-snug" style={{ color: consequential ? "#9a2b1e" : MUTED }}>
        {index === 0 ? "The original." : consequential ? `${plural(consequential, "change")} that matter.` : "Cosmetic edits only."}
      </p>
    </div>
  );
}

/** The page under the cover: what this version asks of you, ticked from your own checks. */
function DetailsPage({ notice, colors, wide, passport = false }: { notice: Notice; colors: { cover: string }; wide: boolean; passport?: boolean }) {
  const intel = useDossierIntelligence(notice.id);
  const k = wide ? 0.66 : 1;
  if (!intel) return null;
  const items = intel.readinessSummary.items.filter((i) => i.requirement.mandatory && i.applicability !== "DOES_NOT_APPLY");
  const shown = items.slice(0, wide ? 3 : 5);
  const done = items.filter((i) => i.readinessStatus === "completed").length;
  const mark = (st: string) => (st === "completed" ? ["✓", "#2d6a47"] : st === "needs_reverification" ? ["!", "#8a5510"] : ["○", MUTED]);
  return (
    <div
      className="flex h-full flex-col rounded-[4px] p-[6.5cqw]"
      style={{
        background: passport
          ? `repeating-radial-gradient(circle at 50% 115%, ${colors.cover}10 0 1.5px, transparent 1.5px 8px), #fbf6ee`
          : PAPER,
        color: INK,
        fontSize: `${4.5 * k}cqw`,
      }}
    >
      <p className="italic" style={{ color: MUTED }}>
        What {versionPhrase(intel.activeVersion)} asks of you
      </p>
      <ul className="mt-[3.5cqw] space-y-[2.4cqw]">
        {shown.map((i) => {
          const [m, c] = mark(i.readinessStatus);
          return (
            <li key={i.requirement.id} className="flex items-baseline gap-[2.4cqw] leading-snug">
              <span className="w-[3.4cqw] flex-none text-center font-semibold" style={{ color: c }}>
                {m}
              </span>
              <span className="min-w-0">{i.requirement.title}</span>
            </li>
          );
        })}
        {items.length > shown.length && (
          <li className="italic" style={{ color: MUTED }}>
            and {items.length - shown.length} more
          </li>
        )}
      </ul>
      <p className="mt-auto flex items-baseline justify-between border-t pt-[2cqw]" style={{ borderColor: "rgba(28,27,25,0.12)" }}>
        <span style={{ color: MUTED }}>
          {done} of {items.length} ready
        </span>
        <span className="font-semibold" style={{ color: colors.cover }}>
          {intel.readinessSummary.percentage}%
        </span>
      </p>
    </div>
  );
}

/** A page of the notice itself: its clauses in the office's own words, so no page that turns is blank. */
function TextPage({ notice, version, page, wide }: { notice: Notice; version: NoticeVersion; page: number; wide: boolean }) {
  const k = wide ? 0.66 : 1;
  const per = wide ? 1 : 2;
  const reqs = version.requirements;
  const items = reqs.length ? Array.from({ length: per }, (_, j) => (page * per + j) % reqs.length) : [];
  return (
    <div className="flex h-full flex-col rounded-[4px] p-[7cqw]" style={{ background: PAPER, color: INK, fontSize: `${4.1 * k}cqw` }}>
      <p className="truncate italic" style={{ color: MUTED }}>
        {notice.departmentOrTrust}
      </p>
      <div className="mt-[3.5cqw] space-y-[3.5cqw]">
        {items.map((n) => (
          <div key={n}>
            <p className="font-semibold leading-tight">
              {n + 1}. {reqs[n].title}
            </p>
            <p className={cn("mt-[1.2cqw] leading-snug", wide ? "line-clamp-2" : "line-clamp-4")} style={{ color: "#3d3a35" }}>
              {reqs[n].evidence.excerpt}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-auto text-center" style={{ color: MUTED }}>
        {page + 2}
      </p>
    </div>
  );
}

const reduceMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The notice as a physical object: each published version is a sheet in a stack, seen in
 * perspective. It deals in on first view, fans out under the pointer, turns as its
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
  scrollTurn = true,
  open,
  pinned = false,
}: {
  notice: Notice;
  className?: string;
  morph?: boolean;
  compact?: boolean;
  scrollTurn?: boolean;
  /** Open like a book: "scroll" as it rises into view, "view" once it is seen. */
  open?: "scroll" | "view";
  /** Stays on screen while the page scrolls: turn with the page instead of with its own position. */
  pinned?: boolean;
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
      (entries) => {
        // A fast scroll can batch several crossings into one call, oldest first: act on the latest.
        const e = entries[entries.length - 1];
        if (!e.isIntersecting) return;
        el.dataset.seen = "";
        // Open where it can be watched: once it is well in view (always, with reduced motion: then there is no scroll effect).
        const opens = open === "view" || (open && reduceMotion());
        if (opens && e.intersectionRatio >= 0.4) {
          timer = window.setTimeout(() => (el.dataset.open = ""), 250);
          io.disconnect();
        } else if (!opens) io.disconnect();
      },
      { threshold: [0.15, 0.4] }
    );
    let timer = 0;
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [open]);

  // Scroll-linked turn, only while on screen, with cached offsets and smooth damping.
  useEffect(() => {
    const el = root.current;
    const sc = scrollStage.current;
    if (!el || !sc || !(scrollTurn || open === "scroll") || reduceMotion()) return;
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
      if (pinned) return Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.documentElement.scrollHeight - vh)));
      const topInView = elTop - window.scrollY;
      return Math.min(1, Math.max(0, (vh - topInView) / (vh + elHeight)));
    };

    const writeTransform = (p: number) => {
      if (scrollTurn) {
        sc.style.setProperty("--sry", `${((p - 0.5) * (pinned ? 18 : 26)).toFixed(2)}deg`);
        if (!pinned) sc.style.setProperty("--sty", `${((0.5 - p) * 36).toFixed(2)}px`);
      }
      // Opens as it rises into view and stays open while it is read.
      if (open === "scroll") el.style.setProperty("--open", Math.min(1, Math.max(0, (p - 0.1) / 0.3)).toFixed(3));
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

    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
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
  }, [scrollTurn, open, pinned]);

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
  const activeLabel = versionTag(notice.versions[activeIdx]);
  const book = open ? bookGeometry(kind) : null;

  const object = (
    <div
      ref={root}
      data-ui
      data-book={book ? "" : undefined}
      className={cn("group/obj relative mx-auto w-full select-none [perspective:1600px]", open === "view" && "book-open-view", className)}
      style={{ aspectRatio: layout.aspect }}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="img"
      aria-label={`${notice.title}: ${notice.versions.length} published versions, ${activeLabel} on top`}
    >
      <div className="absolute inset-0">
        <div
          ref={scrollStage}
          className="absolute inset-0 [transform-style:preserve-3d] will-change-transform"
          style={{
            transform: book
              ? "translate3d(0, calc(var(--sty, 0px) * (1 - 0.5 * var(--open))), 0) rotateY(calc(var(--sry, 0deg) * (1 - 0.85 * var(--open))))"
              : "translate3d(0, var(--sty, 0px), 0) rotateY(var(--sry, 0deg))",
          }}
        >
          <div
            className="absolute inset-0 [transform-style:preserve-3d]"
            style={
              book
                ? {
                    transform: `translate3d(calc(var(--open) * ${book.shiftX}%), calc(var(--open) * ${book.shiftY}%), 0) scale(calc(1 - var(--open) * ${(1 - book.fit).toFixed(3)}))`,
                  }
                : undefined
            }
          >
          <div
            ref={stage}
            className="absolute inset-0 transition-transform duration-[900ms] ease-spring [--fan:1] [transform-style:preserve-3d] group-hover/obj:[--fan:1.55] motion-reduce:transition-none"
            style={{
              // An open book faces the reader square-on, lying back a little as on a desk; the pointer only nudges it.
              transform: book
                ? "rotateX(calc(var(--rx, 9deg) * (1 - var(--open)) + var(--open) * (7deg + (var(--rx, 9deg) - 9deg) * 0.3))) rotateY(calc(var(--ry, -20deg) * (1 - var(--open)) + var(--open) * (var(--ry, -20deg) + 20deg) * 0.3)) rotateZ(calc(1.5deg * (1 - var(--open))))"
                : "rotateX(var(--rx, 9deg)) rotateY(var(--ry, -20deg)) rotateZ(1.5deg)",
            }}
          >
            {notice.versions.map((v, i) => {
              // Rank 0 is the top of the stack; the active version is always on top.
              const rank = i === activeIdx ? 0 : i < activeIdx ? activeIdx - i : i;
              const dropping = arrived === v.id;
              return (
                <div
                  key={v.id}
                  className="absolute transition-[transform,filter] duration-[900ms] ease-spring [container-type:inline-size] [transform-style:preserve-3d] will-change-transform motion-reduce:transition-none"
                  style={{
                    left: layout.left,
                    top: layout.top,
                    width: layout.width,
                    aspectRatio: layout.item,
                    transform: `translate3d(calc(${rank} * ${layout.dx}% * var(--fan)), calc(${rank} * ${layout.dy}% * var(--fan)), ${rank * -46}px) rotateZ(calc(${rank} * -2deg * var(--fan)))`,
                    filter: rank > 0 ? `brightness(${1 - rank * 0.06})` : undefined,
                    opacity: book && rank > 0 ? "calc(1 - var(--open))" : undefined,
                    zIndex: 10 - rank,
                  }}
                >
                  {/* The open book rests on the band: a soft shadow under the whole spread. */}
                  {book && rank === 0 && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute rounded-[10px]"
                      style={{
                        ...(book.sideways ? { left: "-98%", right: "2%", top: "5%", bottom: "-3%" } : { left: "3%", right: "3%", top: "-96%", bottom: "-4%" }),
                        transform: "translateZ(-4px)",
                        background: "rgba(16,14,10,0.55)",
                        filter: "blur(26px)",
                        opacity: "calc(var(--open) * 0.75)",
                      }}
                    />
                  )}
                  {book && rank === 0 && (
                    <div
                      className="absolute inset-0 rounded-[4px]"
                      style={{ transform: "translateZ(-2px)", boxShadow: `${book.sideways ? edges(1, 0.6) : edges(0.6, 1)}, 0 18px 22px rgba(28,27,25,0.18)` }}
                    >
                      <DetailsPage notice={notice} colors={colors} wide={!book.sideways} passport={kind === "passport"} />
                      <Gutter side={book.sideways ? "right" : "bottom"} />
                    </div>
                  )}
                  {/* Pages riffle over after the cover, one after another; the last carries the version. */}
                  {book &&
                    rank === 0 &&
                    LEAVES.map((k) => (
                      <div
                        key={`leaf-${k}`}
                        className={cn("book-leaf absolute inset-0 [transform-style:preserve-3d]", book.sideways ? "book-leaf-y" : "book-leaf-x")}
                        style={{ transformOrigin: book.sideways ? "left center" : "center top", "--k": k, "--z": `${-0.4 - k * 0.4}px` } as CSSProperties}
                      >
                        <div className="absolute inset-0 overflow-hidden rounded-[4px] [backface-visibility:hidden]" style={{ background: PAPER, boxShadow: "0 1px 2px rgba(28,27,25,0.14)" }}>
                          <TextPage notice={notice} version={v} page={k * 2} wide={!book.sideways} />
                        </div>
                        <div
                          className="absolute inset-0 rounded-[4px] [backface-visibility:hidden]"
                          style={{
                            transform: book.sideways ? "rotateY(180deg)" : "rotateX(180deg)",
                            background: PAPER,
                            boxShadow: k === LEAVES.length - 1 ? (book.sideways ? edges(-1, 0.6) : edges(0.6, -1)) : undefined,
                          }}
                        >
                          {k === LEAVES.length - 1 ? (
                            <>
                              <InsidePage notice={notice} index={i} consequential={changed[i].consequential} colors={colors} wide={!book.sideways} />
                              <Gutter side={book.sideways ? "left" : "top"} />
                            </>
                          ) : (
                            <div className="h-full overflow-hidden rounded-[4px]">
                              <TextPage notice={notice} version={v} page={k * 2 + 1} wide={!book.sideways} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  <div
                    className="absolute inset-0 [transform-style:preserve-3d]"
                    style={
                      book && rank === 0
                        ? {
                            transformOrigin: book.sideways ? "left center" : "center top",
                            transform: book.sideways ? "rotateY(calc(var(--open) * -178deg))" : "rotateX(calc(var(--open) * 178deg))",
                          }
                        : undefined
                    }
                  >
                  {book && rank === 0 && (
                    <div
                      className="absolute inset-0 rounded-[4px] [backface-visibility:hidden]"
                      style={{ transform: book.sideways ? "rotateY(180deg)" : "rotateX(180deg)", background: kind === "passport" ? colors.cover : "#efe9dc" }}
                    />
                  )}
                  <div
                    key={dropping ? `${v.id}-drop` : v.id}
                    className={cn("absolute inset-0 rounded-[4px] [backface-visibility:hidden]", dropping ? "sheet-drop" : "sheet-deal")}
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
                </div>
              );
            })}
          </div>
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
