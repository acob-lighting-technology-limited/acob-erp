import type { Metadata } from "next"
import { HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { loadDirectory } from "@/lib/directory/load"
import { prefetchQueries } from "@/lib/query/prefetch"
import { QUERY_KEYS } from "@/lib/query-keys"
import { DirectoryContent } from "./directory-content"

export const metadata: Metadata = {
  title: "Directory",
  description: "Find any colleague's contact details — email, phone, department and office.",
}

export default async function DirectoryPage() {
  // Load the directory on the server so the page paints with names instead of a
  // skeleton followed by a second round trip (audit 6.8). Same key and shape as
  // the client's fetchDirectoryRows, so React Query treats it as already fetched.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const state = await prefetchQueries(
    user ? [{ queryKey: QUERY_KEYS.directory(), queryFn: () => loadDirectory(supabase) }] : []
  )

  return (
    <HydrationBoundary state={state}>
      <DirectoryContent />
    </HydrationBoundary>
  )
}
