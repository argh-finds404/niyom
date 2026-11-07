"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** A second line under the label. */
  hint?: string;
  /** Something before the label: a colour swatch, a code. */
  lead?: ReactNode;
}

/**
 * A listbox in the house style, in place of the browser's own menu.
 * Keyboard: arrows and Home/End move, Enter or Space chooses, Escape closes (without closing the dialog it sits in).
 */
export function Select({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: {
  id: string;
  /** Names the list for screen readers; the visible <label for={id}> names the button. */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[chosen];

  // Close on a press anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(chosen);
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) setActive((a) => Math.min(last, a + 1));
        else show();
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((a) => Math.max(0, a - 1));
        else show();
        break;
      case "Home":
      case "End":
        if (open) {
          e.preventDefault();
          setActive(e.key === "Home" ? 0 : last);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else show();
        break;
      case "Escape":
        if (open) {
          // The dialog would close on Escape too; this one only closes the list.
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-[var(--r-control)] border bg-white/60 px-3.5 py-2 text-left text-[17px] transition-[border-color,background-color,box-shadow] duration-200",
          open
            ? "border-[#1c1b19] bg-white shadow-[0_0_0_4px_rgba(28,27,25,0.07)]"
            : "border-[#1c1b19]/20 hover:border-[#1c1b19]/55 hover:bg-white/80"
        )}
      >
        {current?.lead}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{current?.label}</span>
          {current?.hint && <span className="block truncate text-[13.5px] italic leading-tight text-[#6b655b]">{current.hint}</span>}
        </span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 flex-none text-[#6b655b] transition-transform duration-300 ease-spring", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          className="anim-drop absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[300px] overflow-y-auto overscroll-contain rounded-[14px] bg-[#fcfbf8] p-1.5 shadow-[0_0_0_1px_rgba(28,27,25,0.1),0_24px_48px_-20px_rgba(28,27,25,0.45)]"
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={on}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[9px] px-3 py-2.5 text-[16px] leading-snug transition-colors duration-150",
                  i === active ? "bg-[#1c1b19]/[0.07]" : ""
                )}
              >
                {o.lead}
                <span className="min-w-0 flex-1">
                  <span className={cn("block", on && "font-semibold")}>{o.label}</span>
                  {o.hint && <span className="block text-[13.5px] italic text-[#6b655b]">{o.hint}</span>}
                </span>
                <Check aria-hidden className={cn("h-4 w-4 flex-none", on ? "opacity-100" : "opacity-0")} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
