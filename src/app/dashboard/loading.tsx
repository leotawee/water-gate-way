/* Skeleton of the live dashboard's REAL shape (navy header, receivedAt line, camera strip,
   AI count + instrument tiles, water panel, 420px control rail) so the streamed
   content swaps in without a layout jump. Flat static blocks: no shimmer, no animation. */
const block = "rounded bg-surface-2";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="flex min-h-dvh flex-col bg-bg">
      <span className="sr-only">กำลังโหลด</span>

      {/* Navy dashboard header (DashboardHeader's shape, not the white AppHeader) */}
      <header className="bg-brand px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1376px] flex-wrap items-center gap-x-4 gap-y-3">
          <div className={`${block} h-6 w-16 bg-white/15`} />
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <div className="size-11 shrink-0 rounded-xl bg-white/15" />
            <div className="min-w-0 space-y-1.5">
              <div className={`${block} h-5 w-40 bg-white/15`} />
              <div className={`${block} h-3 w-28 bg-white/15`} />
            </div>
          </div>
          <div className={`${block} h-6 w-24 bg-white/15`} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1376px] flex-1 space-y-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8">
        {/* receivedAt line */}
        <div className={`${block} h-4 w-60`} />

        {/* Cameras: three tiles across from 640px (phones stack) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} aria-hidden="true" className="aspect-video rounded-2xl bg-black" />
          ))}
        </div>

        {/* Readings: AI count, tall electric tile, floats + wire-break (same placement as the live grid) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-[auto_1fr]">
          <section aria-hidden="true" className="rounded-2xl border border-border bg-surface p-5 md:col-start-2 md:row-start-1">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className={`${block} h-4 w-28`} />
                <div className={`${block} h-6 w-20 rounded-full`} />
              </div>
              <div className={`${block} h-9 w-14`} />
            </div>
          </section>
          {["electric", "floats", "wire"].map((k, i) => (
            <section
              key={k}
              aria-hidden="true"
              className={`rounded-2xl border border-border bg-surface p-5 ${
                i === 0 ? "md:col-start-1 md:row-span-2 md:row-start-1" : "hidden md:block md:col-start-2 md:row-start-2"
              }`}
            >
              <div className={`${block} h-4 w-24`} />
              <div className="mt-3 space-y-2">
                {Array.from({ length: i === 0 ? 7 : 3 }, (_, j) => (
                  <div key={j} className="flex items-center justify-between gap-4">
                    <div className={`${block} h-4 w-20`} />
                    <div className={`${block} h-4 w-12`} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Water level + detection beside the 420px control rail from lg */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-6">
            <section aria-hidden="true" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <div className={`${block} mb-4 h-5 w-20`} />
              <div className="grid grid-cols-1 gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
                <div className={`${block} h-60 w-[72px]`} />
                <div className={`${block} h-60 min-w-0`} />
              </div>
            </section>
          </div>

          {/* Control rail: brand header, mode segment, four device rows with status line */}
          <aside aria-hidden="true" className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="bg-brand px-5 py-3.5">
                <div className={`${block} h-5 w-24 bg-white/15`} />
              </div>
              <div className="border-b border-rule px-5 py-4">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-12" />
                  ))}
                </div>
              </div>
              <div className="divide-y divide-rule px-5">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`${block} h-5 w-24`} />
                      <div className={`${block} h-5 w-16 rounded-full`} />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div className={`${block} h-11`} />
                      <div className={`${block} h-11`} />
                    </div>
                    <div className={`${block} mt-1.5 h-5 w-36`} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
