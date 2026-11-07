"use client";

import { useEffect, ViewTransition, type ReactNode } from "react";
import type { Chapter } from "@/lib/chapters";
import { cn } from "@/lib/utils";

/**
 * Every screen's root. The page fades and rises on navigation (React <ViewTransition>),
 * and `chapter` tints the whole document to the dossier's colour world via html:has().
 */
export function Page({
  chapter,
  bleed = false,
  children,
  className,
}: {
  chapter?: Chapter;
  bleed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  // The visible page owns the document's colour world. Next keeps visited pages mounted but
  // hidden (their effects are cleaned up), so this always follows the page you are looking at.
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.chapter = chapter ?? "base";
    return () => {
      html.dataset.chapter = "base";
    };
  }, [chapter]);

  return (
    <ViewTransition enter="page" exit="page" default="none">
      <div
        data-page-chapter={chapter}
        className={cn(!bleed && "mx-auto w-full max-w-[1240px] px-4 pb-24 pt-8 sm:px-8 lg:px-10 lg:pt-12", className)}
      >
        {children}
      </div>
    </ViewTransition>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-8 lg:px-10", className)}>{children}</div>;
}

/** A full-width band whose colour also runs under the rail, as in the reference. */
export function Bleed({ children, className, ...rest }: React.HTMLAttributes<HTMLElement> & { [k: `data-${string}`]: string | undefined }) {
  return (
    <section className={cn("-ml-[var(--rail-w)] pl-[var(--rail-w)]", className)} {...rest}>
      {children}
    </section>
  );
}
