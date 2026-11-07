import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-24 sm:px-8 lg:px-10">
      <p className="text-[18px] italic text-ink-3">Not in the ledger</p>
      <h1 className="display mt-3 max-w-[18ch] text-[44px] sm:text-[56px]">We don&rsquo;t keep a dossier at this address.</h1>
      <p className="mt-6 max-w-[56ch] text-[18px] leading-relaxed text-ink-2">
        The link may point to a notice NIYOM does not monitor, or to one that was withdrawn.
      </p>
      <Link
        href="/explore"
        className="mt-10 inline-flex h-11 items-center rounded-[var(--r-control)] border border-ink bg-ink px-4 text-[16px] font-semibold text-ground transition-colors hover:bg-ink/88"
      >
        Browse the directory
      </Link>
    </div>
  );
}
