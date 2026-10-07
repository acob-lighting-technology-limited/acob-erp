import { HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { listRequisitions } from "@/lib/requisitions/load"
import { loadMyProfile } from "@/lib/profile/my-profile"
import { prefetchQueries } from "@/lib/query/prefetch"
import { QUERY_KEYS } from "@/lib/query-keys"
import { RequisitionListPage } from "./requisitions-content"

export default async function RequisitionsPage() {
  // Prefetch the opening "My requisitions" tab and the requester's own profile
  // (the new-request dialog shows its department) — audit 6.8. Same keys and
  // shapes as useRequisitions({ userOnly: true }) and useMyProfile().
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const state = await prefetchQueries(
    user
      ? [
          {
            queryKey: QUERY_KEYS.requisitions({ userOnly: true }),
            queryFn: () => listRequisitions(supabase, user.id, { userOnly: true }),
          },
          {
            queryKey: QUERY_KEYS.myProfile(),
            queryFn: () => loadMyProfile(supabase, user.id),
          },
        ]
      : []
  )

  return (
    <HydrationBoundary state={state}>
      <RequisitionListPage />
    </HydrationBoundary>
  )
}
