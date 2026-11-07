"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { useNiyomStore } from "@/hooks/useNiyomStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useScenarios } from "@/hooks/useScenarios";
import { versionOf } from "@/hooks/useDossierIntelligence";
import { CATEGORY_LABEL, plural, shortTitle, versionTag } from "@/lib/format";
import { Overlay } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  group: "Dossiers" | "Requirements" | "Pages" | "Scenarios";
  title: string;
  hint?: string;
  code?: string;
  keywords: string;
  run: () => void;
}

const GROUP_ORDER: Command["group"][] = ["Dossiers", "Requirements", "Scenarios", "Pages"];

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const notices = useNiyomStore((s) => s.notices);
  const activeNoticeId = useNiyomStore((s) => s.activeNoticeId);
  const setActiveNotice = useNiyomStore((s) => s.setActiveNotice);
  const scenarios = useScenarios();
  const openDrawer = useUiStore((s) => s.openDrawer);
  const setApiOpen = useUiStore((s) => s.setApiOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string, noticeId?: string) => () => {
      if (noticeId) setActiveNotice(noticeId);
      onClose();
      router.push(href);
    };
    const list: Command[] = [];
    notices.forEach((n) => {
      const v = versionOf(n, n.activeVersionNumber);
      list.push({
        id: `d-${n.id}`,
        group: "Dossiers",
        title: shortTitle(n),
        hint: `${CATEGORY_LABEL[n.category]} · ${n.institution}`,
        code: versionTag(v.versionLabel),
        keywords: `${n.title} ${n.institution} ${n.departmentOrTrust} ${n.category} ${n.zone}`,
        run: go(`/notice/${n.id}`, n.id),
      });
    });
    notices.forEach((n) => {
      versionOf(n, n.activeVersionNumber).requirements.forEach((r) => {
        list.push({
          id: `r-${n.id}-${r.id}`,
          group: "Requirements",
          title: r.title,
          hint: shortTitle(n),
          code: r.code,
          keywords: `${r.code} ${r.title} ${r.value} ${n.title}`,
          run: go(`/notice/${n.id}#req-${r.id}`, n.id),
        });
      });
    });
    list.push(
      {
        id: "s1",
        group: "Scenarios",
        title: "Start prepared on v1.0",
        hint: "Walkthrough step 1 · every required item checked",
        keywords: "baseline v1 ready reset scenario",
        run: () => {
          scenarios.baseline();
          onClose();
        },
      },
      {
        id: "s2",
        group: "Scenarios",
        title: "A corrigendum arrives",
        hint: "Walkthrough step 2 · watch earlier checks go stale",
        keywords: "simulate v2 corrigendum update stale scenario",
        run: () => {
          scenarios.simulateCorrigendum();
          onClose();
        },
      },
      {
        id: "s3",
        group: "Scenarios",
        title: "The railway refund case",
        hint: "Walkthrough step 3 · two official timelines disagree",
        keywords: "railway shohoz refund bkash nagad scenario",
        run: () => {
          scenarios.openRailway();
          onClose();
        },
      },
      {
        id: "s4",
        group: "Scenarios",
        title: "Flag a discrepancy",
        hint: "Add a field report",
        keywords: "flag report discrepancy community",
        run: () => openDrawer({ noticeId: activeNoticeId }),
      },
      {
        id: "s5",
        group: "Scenarios",
        title: "Reset demo data",
        keywords: "reset clear demo",
        run: () => {
          scenarios.reset();
          onClose();
        },
      }
    );
    (
      [
        ["Overview", "/"],
        ["Directory", "/explore"],
        ["Specification", `/notice/${activeNoticeId}`],
        ["Changes", `/changes/${activeNoticeId}`],
        ["My plan", "/my-plan"],
      ] as const
    ).forEach(([title, href]) =>
      list.push({ id: `p-${title}`, group: "Pages", title, keywords: title, run: go(href) })
    );
    list.push(
      {
        id: "p-api",
        group: "Pages",
        title: "Live Backend API",
        hint: "Inspect live server responses, wordDiff tokens & curl commands",
        keywords: "api backend server json health evaluate compare state",
        run: () => setApiOpen(true),
      },
      {
        id: "p-help",
        group: "Pages",
        title: "How NIYOM works",
        hint: "Guide & keyboard shortcuts",
        keywords: "help guide keyboard shortcuts how it works",
        run: () => setHelpOpen(true),
      }
    );
    return list;
  }, [notices, activeNoticeId, setActiveNotice, router, scenarios, openDrawer, setApiOpen, setHelpOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const matched = terms.length
      ? commands.filter((c) => {
          const hay = `${c.title} ${c.code ?? ""} ${c.keywords}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
      : commands.filter((c) => c.group !== "Requirements");
    return GROUP_ORDER.flatMap((g) => matched.filter((c) => c.group === g).slice(0, g === "Requirements" ? 8 : 7));
  }, [commands, query]);

  const safeCursor = Math.min(cursor, Math.max(results.length - 1, 0));

  const move = (delta: number) => {
    if (!results.length) return;
    const next = (safeCursor + delta + results.length) % results.length;
    setCursor(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="ov-center mx-auto mt-[9vh] flex max-h-[min(660px,80vh)] w-[calc(100%-32px)] max-w-[680px] flex-col overflow-hidden rounded-[var(--r-panel)] bg-[#fcfbf8] text-[#1c1b19] shadow-[0_0_0_1px_rgba(28,27,25,0.08),0_40px_100px_-30px_rgba(28,27,25,0.5)]">
      <div className="flex items-center gap-3 border-b border-[#1c1b19]/10 px-5">
        <Search className="h-5 w-5 flex-none text-[#6b655b]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            }
            if (e.key === "Enter" && results[safeCursor]) {
              e.preventDefault();
              results[safeCursor].run();
            }
          }}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={results[safeCursor] ? `cmd-${results[safeCursor].id}` : undefined}
          placeholder="Search notices, codes like REQ-DOC-01, or actions"
          className="h-16 min-w-0 flex-1 bg-transparent text-[21px] outline-none placeholder:italic placeholder:text-[#6b655b] focus-visible:outline-none"
        />
        <kbd className="num hidden flex-none rounded-[6px] border border-[#1c1b19]/20 px-1.5 text-[13px] text-[#6b655b] sm:inline">Esc</kbd>
      </div>

      <ul id="palette-list" ref={listRef} role="listbox" className="flex-1 overflow-y-auto py-3">
        {results.length === 0 && (
          <li className="px-6 py-12 text-center text-[17px] italic text-[#47433c]">
            Nothing in the ledger matches &ldquo;{query}&rdquo;.
            <span className="mt-1 block text-[15px] not-italic text-[#6b655b]">
              Try a code such as <span className="code">REQ-ICT-04</span> or an institution name.
            </span>
          </li>
        )}
        {results.map((c, i) => {
          const header = i === 0 || results[i - 1].group !== c.group;
          const selected = i === safeCursor;
          return (
            <li key={c.id} role="presentation">
              {header && (
                <p className="flex items-center gap-3 px-5 pb-1.5 pt-4 text-[15px] italic text-[#6b655b]">
                  <span aria-hidden className="h-px w-6 bg-[#1c1b19]/40" />
                  {c.group}
                </p>
              )}
              <div
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={selected}
                data-index={i}
                onMouseMove={() => cursor !== i && setCursor(i)}
                onClick={c.run}
                className={cn(
                  "relative mx-2 flex cursor-pointer items-center gap-4 rounded-[var(--r-control)] px-3 py-2.5 transition-colors duration-150",
                  selected ? "bg-[#1c1b19]/[0.06]" : "bg-transparent"
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-y-2 left-0 w-[2px] bg-[#1c1b19] transition-opacity", selected ? "opacity-100" : "opacity-0")}
                />
                {c.code && <span className="code w-[96px] flex-none truncate text-[15px] text-[#47433c]">{c.code}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{c.title}</span>
                  {c.hint && <span className="block truncate text-[14.5px] italic text-[#6b655b]">{c.hint}</span>}
                </span>
                <CornerDownLeft className={cn("h-4 w-4 flex-none text-[#6b655b] transition-opacity", selected ? "opacity-100" : "opacity-0")} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-5 border-t border-[#1c1b19]/15 px-5 py-2.5 text-[14px] italic text-[#6b655b]">
        <span>↑ ↓ to move</span>
        <span>Enter to open</span>
        <span className="num ml-auto not-italic">{plural(results.length, "result")}</span>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const close = () => setOpen(false);
  return (
    <Overlay open={open} onClose={close} label="Command palette" placement="center">
      <PaletteBody onClose={close} />
    </Overlay>
  );
}
