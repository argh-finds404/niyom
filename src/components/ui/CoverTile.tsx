import type { ReactNode } from "react";
import { chapterOf, kindOf } from "@/lib/chapters";
import { KindGlyph } from "./NoticeFaces";
import { cn } from "@/lib/utils";

/** A dossier shown as a book cover in its chapter colours. */
export function CoverTile({
  noticeId,
  category,
  title,
  top,
  bottom,
  className,
}: {
  noticeId: string;
  category: string;
  title: string;
  top?: ReactNode;
  bottom?: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-cover={chapterOf(noticeId)}
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-[var(--r-card)] p-4 shadow-[0_10px_22px_-18px_rgba(28,27,25,0.28)] transition-transform duration-500 ease-spring",
        className
      )}
    >
      <span className="flex items-start justify-between gap-2 text-[14px] text-ink-2">
        <span className="code">{top}</span>
        <span aria-hidden className="font-bengali text-[15px] leading-none">
          ন
        </span>
      </span>
      <KindGlyph kind={kindOf(category)} className="pointer-events-none absolute right-3 top-1/2 h-[38%] max-h-16 -translate-y-1/2 text-ink opacity-45" />
      <span>
        <span aria-hidden className="mb-2 block h-px w-8 bg-ink" />
        <span className="block text-[17px] font-semibold leading-tight tracking-[-0.01em]">{title}</span>
        {bottom && <span className="num mt-1 block text-[14px] italic text-ink-2">{bottom}</span>}
      </span>
    </span>
  );
}
