"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { calculateNoticeReadiness, compareNoticeVersions } from "@/domain";
import type { RequirementChange } from "@/domain/types";
import { DEFAULT_APPLICANT_PROFILE, SEED_NOTICES } from "@/data/seed/notices.seed";
import { asPhrase, dayDelta, formatDate, isConsequential, shortTitle, versionTag } from "@/lib/format";
import { wordDiff } from "@/lib/wordDiff";
import { Container } from "@/components/ui/Page";

const NOTICE_ID = "notice-merit-2026";

/** What the change means for someone who had prepared everything against the first version. */
function consequence(c: RequirementChange): string {
  const days = c.category === "deadline" ? dayDelta(c.previous?.value, c.current?.value) : null;
  if (days) return `The deadline moves to ${formatDate(c.current!.value)}, ${Math.abs(days)} days ${days > 0 ? "later" : "earlier"}. Your check is stale.`;
  if (c.previous && !c.previous.mandatory && c.current?.mandatory) return "It was optional. Now it is required, and you have not prepared it.";
  return "The paper in your folder no longer matches. Your check is stale.";
}

/**
 * The corrigendum, word by word: each change that matters from the first published version to the
 * latest rewrites itself as you scroll, and readiness falls with it. Every figure comes from the
 * engine, by applying the changes one at a time to a fully prepared first version.
 */
function useScript() {
  return useMemo(() => {
    const notice = SEED_NOTICES.find((n) => n.id === NOTICE_ID)!;
    const first = notice.versions[0];
    const last = notice.versions[notice.versions.length - 1];
    const changes = compareNoticeVersions(first, last).filter(
      (c) => isConsequential(c) && c.previous && c.current && c.previous.value !== c.current.value
    );
    const records = first.requirements
      .filter((r) => r.mandatory)
      .map((r) => ({
        noticeId: NOTICE_ID,
        requirementId: r.id,
        checked: true,
        verifiedAgainstValue: r.value,
        verifiedAgainstVersion: first.versionNumber,
        updatedAt: first.publishedAt,
      }));
    const readinessAfter = (k: number) => {
      const version =
        k === changes.length
          ? last
          : { ...first, requirements: first.requirements.map((r) => changes.slice(0, k).find((c) => c.requirementId === r.id)?.current ?? r) };
      const n = { ...notice, versions: [version], activeVersionNumber: version.versionNumber };
      return calculateNoticeReadiness(n, DEFAULT_APPLICANT_PROFILE, records, []).percentage;
    };
    return {
      title: shortTitle(notice),
      from: versionTag(first),
      to: versionTag(last),
      clauses: changes.map((c) => ({
        id: c.requirementId,
        title: c.title,
        // Dates are set the way people read them, so the diff shows "15" giving way to "25".
        tokens: c.category === "deadline" ? wordDiff(formatDate(c.previous!.value), formatDate(c.current!.value)) : wordDiff(c.previous!.value, c.current!.value),
        note: consequence(c),
      })),
      readiness: changes.map((_, k) => readinessAfter(k)).concat(readinessAfter(changes.length)),
    };
  }, []);
}

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export function CorrigendumScene() {
  const { title, from, to, clauses, readiness } = useScript();
  const ref = useRef<HTMLElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const n = clauses.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let shown = -1;
    let target = 0;
    let p = -1;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Where each clause's centre sits in the column, re-measured when fonts or the window change size.
    let centres: number[] = [];
    let windowH = 0;
    const measure = () => {
      const col = columnRef.current;
      windowH = windowRef.current?.clientHeight ?? 0;
      centres = col ? [...col.children].map((c) => (c as HTMLElement).offsetTop + (c as HTMLElement).offsetHeight / 2) : [];
    };
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    // The scene eases towards the scroll position instead of snapping to it, so it glides.
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      target = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      p = p < 0 || still.matches ? target : p + (target - p) * 0.14;
      if (Math.abs(target - p) < 0.0004) p = target;
      else raf = requestAnimationFrame(update);
      el.style.setProperty("--p", p.toFixed(4));
      // One clause after another: the column holds each clause in the centre, then glides to the next
      // during the last fifth of its stretch, so there is never an empty or overlapping frame.
      const fi = Math.min(n - 0.0001, p * n);
      const i = Math.floor(fi);
      const k = Math.min(1, Math.max(0, (fi - i - 0.8) / 0.2));
      const move = i < n - 1 ? k * k * (3 - 2 * k) : 0;
      el.style.setProperty("--focus", (i + move).toFixed(4));
      if (columnRef.current && centres.length === n && !still.matches) {
        const drift = i < n - 1 ? 44 * (fi - i - move) : 44 * Math.min(0.8, fi - i);
        const y = windowH / 2 - (centres[i] + (centres[Math.min(n - 1, i + 1)] - centres[i]) * move + drift);
        columnRef.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }
      // A change "lands" two thirds of the way through its stretch of the scroll; with reduced motion, all have.
      const landed = still.matches ? n : Math.min(n, Math.floor(p * n + 1 / 3));
      if (landed !== shown && numRef.current) {
        shown = landed;
        numRef.current.textContent = String(readiness[landed]);
        numRef.current.classList.remove("num-roll");
        void numRef.current.offsetWidth; // restart the roll
        numRef.current.classList.add("num-roll");
        if (landed) numRef.current.dataset.down = "";
        else delete numRef.current.dataset.down;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // Listen only while the scene is on screen; elsewhere it costs nothing.
    const io = new IntersectionObserver((entries) => {
      // Batched crossings arrive oldest first; the latest says where the scene is now.
      if (entries[entries.length - 1].isIntersecting) {
        el.dataset.live = "";
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
      } else {
        delete el.dataset.live;
        window.removeEventListener("scroll", onScroll);
      }
    });
    io.observe(el);
    if (columnRef.current) ro.observe(columnRef.current);
    if (windowRef.current) ro.observe(windowRef.current);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [n, readiness]);

  return (
    <section ref={ref} data-rail="The corrigendum" data-cover="film" aria-labelledby="scene" className="scene film relative -ml-[var(--rail-w)] pl-[var(--rail-w)]" style={v({ "--p": 0, "--n": n })}>
      <div className="scene-stage film sticky top-[var(--bar-h)] flex h-[calc(100svh-var(--bar-h))] flex-col justify-center overflow-hidden">
        <span aria-hidden className="film-sprockets left-0" />
        <span aria-hidden className="film-sprockets right-0" />
        <span aria-hidden className="film-grain" />
        <span aria-hidden className="film-vignette" />
        <Container className="flex h-full flex-col py-8">
          <h2 id="scene" className="text-[16px] italic text-ink-3">
            {title}, from {asPhrase(from)} to {to}. Scroll, and watch what a corrigendum does to a prepared applicant.
          </h2>

          {/* Screen readers get the whole story at once; the stage below is its animation. */}
          <ol className="sr-only">
            {clauses.map((c, i) => (
              <li key={c.id}>
                {c.title}: {c.tokens.filter((t) => t.kind !== "add").map((t) => t.text).join(" ")} became{" "}
                {c.tokens.filter((t) => t.kind !== "del").map((t) => t.text).join(" ")}. {c.note} Readiness {readiness[i + 1]}%.
              </li>
            ))}
          </ol>

          <div ref={windowRef} aria-hidden className="scene-window relative my-6 min-h-0 flex-1 overflow-hidden">
            <div ref={columnRef} className="scene-column absolute inset-x-0 top-0 will-change-transform">
            {clauses.map((c, i) => {
              // Word by word: every struck word draws its line in turn, then every new word arrives in turn.
              const words = c.tokens.flatMap((t) => t.text.split(" ").map((w) => ({ kind: t.kind, w })));
              const dels = words.filter((x) => x.kind === "del").length || 1;
              const adds = words.filter((x) => x.kind === "add").length || 1;
              let d = 0;
              let a = 0;
              return (
                <div key={c.id} className="scene-clause py-[6vh]" style={v({ "--a": i / n, "--b": (i + 1) / n, "--i": i })}>
                  <p className="text-[15px] italic text-ink-3">
                    <span className="num">{i + 1}</span> of <span className="num">{n}</span>, {c.title}
                  </p>
                  <p className="display mt-3 max-w-[22ch] text-[clamp(30px,5.4vw,72px)] leading-[1.06]">
                    {words.map((x, k) =>
                      x.kind === "same" ? (
                        <span key={k}>{x.w} </span>
                      ) : (
                        <span key={k}>
                          <span
                            className={x.kind === "del" ? "rl-del" : "rl-ins"}
                            style={v({ "--t": x.kind === "del" ? 0.06 + (d++ / dels) * 0.28 : 0.36 + (a++ / adds) * 0.34 })}
                          >
                            {x.w}
                          </span>{" "}
                        </span>
                      )
                    )}
                  </p>
                  <p className="rl-fade mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]" style={v({ "--t": 0.76 })}>
                    {c.note}
                  </p>
                </div>
              );
            })}
            </div>
          </div>

          <div aria-hidden className="flex flex-wrap items-end justify-between gap-6 pt-2">
            {/* A silent-film title card. */}
            <p className="intertitle flex items-baseline gap-3 px-6 pb-3 pt-4">
              <span className="self-center text-[15px] italic text-ink-3">Readiness</span>
              <span className="inline-block overflow-hidden">
                <span ref={numRef} className="scene-num display num inline-block text-[clamp(56px,8.5vw,112px)] leading-[0.95]">
                  {readiness[0]}
                </span>
              </span>
              <span className="text-[22px] text-ink-2">%</span>
            </p>
            <div className="flex items-center gap-6">
              <ol className="flex gap-1.5">
                {clauses.map((c, i) => (
                  <li key={c.id} className="h-[3px] w-10 overflow-hidden rounded-full bg-ink/15 sm:w-14">
                    <span className="scene-bar block h-full origin-left bg-ink" style={v({ "--a": i / n, "--b": (i + 1) / n })} />
                  </li>
                ))}
              </ol>
              <span className="scene-stamp code rounded-[var(--r-mark)] border-[2.5px] border-crit px-4 py-1.5 text-[21px] text-crit outline outline-1 outline-offset-[3px] outline-crit/60 sm:px-5 sm:text-[28px]">Corrigendum</span>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
