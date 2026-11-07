"use client";

import { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="mx-auto w-full max-w-[1240px] px-5 py-24 sm:px-8 lg:px-10">
      <p className="text-[18px] italic text-crit">Something went wrong</p>
      <h1 className="display mt-3 max-w-[20ch] text-[40px] sm:text-[52px]">This page didn&rsquo;t load.</h1>
      <p className="mt-6 max-w-[56ch] text-[18px] leading-relaxed text-ink-2">
        Your checks and profile are stored on this device and were not affected. Try again, or return to the overview.
      </p>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center border border-ink bg-ink px-4 text-[16px] font-semibold text-ground transition-colors hover:bg-ink/88"
        >
          Try again
        </button>
        <a href="/" className="inline-flex h-11 items-center border border-ink px-4 text-[16px] font-semibold transition-colors hover:bg-ink/[0.06]">
          Overview
        </a>
      </div>
    </div>
  );
}
