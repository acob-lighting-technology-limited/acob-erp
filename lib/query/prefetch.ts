import "server-only"
import { QueryClient, dehydrate, type DehydratedState, type QueryKey } from "@tanstack/react-query"

type PrefetchEntry = { queryKey: QueryKey; queryFn: () => Promise<unknown> }

/**
 * Run a page's first queries on the server and hand the results to the client
 * cache (render the page's client component inside
 * `<HydrationBoundary state={...}>`). The client then paints with data instead
 * of a skeleton and does not refetch while the data is fresh (30s, matching
 * providers/query-provider.tsx).
 *
 * Use the same query key AND the same data shape as the client queryFn. A
 * failed prefetch is simply left out, and the client fetches as it did before.
 */
export async function prefetchQueries(entries: PrefetchEntry[]): Promise<DehydratedState> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30 * 1000 } } })
  await Promise.all(entries.map((entry) => queryClient.prefetchQuery(entry)))
  return dehydrate(queryClient)
}
