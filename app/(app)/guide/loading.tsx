import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the guide's opening: hero panel, stat band, then a module card grid. */
export default function Loading() {
  return (
    <div className="bg-background min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="bg-card rounded-2xl border px-5 py-14 sm:px-10 sm:py-20">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-12 w-full max-w-3xl sm:h-16" />
          <Skeleton className="mt-6 h-5 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-5 w-2/3 max-w-xl" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-36" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card p-5 sm:p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
