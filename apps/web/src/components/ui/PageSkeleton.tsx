export function PageSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-7" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace</span>

      <div className="space-y-3">
        <div className="h-3 w-36 animate-pulse rounded-full bg-beige/80" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-beige" />
        <div className="h-4 w-[28rem] max-w-full animate-pulse rounded-full bg-beige/70" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[152px] animate-pulse rounded-2xl border border-beige bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="h-3 w-24 rounded-full bg-beige/80" />
              <div className="h-9 w-9 rounded-full bg-ivory" />
            </div>
            <div className="mt-6 h-7 w-28 rounded-md bg-beige" />
            <div className="mt-5 h-3 w-full rounded-full bg-ivory" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-5">
        <div className="h-[400px] animate-pulse rounded-2xl border border-beige bg-white p-6">
          <div className="h-4 w-40 rounded-full bg-beige" />
          <div className="mt-3 h-3 w-64 rounded-full bg-ivory" />
          <div className="mt-12 h-[230px] rounded-xl bg-ivory" />
        </div>
        <div className="h-[400px] animate-pulse rounded-2xl border border-beige bg-white p-6">
          <div className="h-4 w-28 rounded-full bg-beige" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-ivory" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded-full bg-beige/80" />
                  <div className="h-3 w-1/2 rounded-full bg-ivory" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
