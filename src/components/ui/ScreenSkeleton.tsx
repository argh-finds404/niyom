/** Route placeholder in the final geometry: flat bars, no shimmer, no layout shift. */
export function ScreenSkeleton() {
  return (
    <div aria-busy aria-label="Loading" className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-10 sm:px-8 lg:px-10 lg:pt-14">
      <div className="grid grid-cols-1 gap-x-20 gap-y-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div>
          <span className="skeleton block aspect-[1/1.18] w-full max-w-[300px] lg:max-w-none" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="skeleton block h-5 w-full" />
            ))}
          </div>
        </div>
        <div className="max-w-[720px]">
          <span className="skeleton block h-4 w-72" />
          <span className="skeleton mt-5 block h-11 w-full" />
          <span className="skeleton mt-3 block h-11 w-2/3" />
          <span className="skeleton mt-5 block h-6 w-1/2" />
          <div className="mt-14 space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 border-t border-ink/10 pt-7">
                <span className="skeleton block h-4 w-40" />
                <span className="skeleton block h-6 w-3/4" />
                <span className="skeleton block h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
