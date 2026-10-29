"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * Signs out and leaves nothing of the session behind.
 *
 * Besides ending the Supabase session it empties the query cache and does a full page load to the login
 * page. A soft navigation would keep both the cached data and the router's cached pages in memory, so on a
 * shared device the Back button could show the previous person's screens.
 */
export function useLogout() {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await createClient().auth.signOut()
    queryClient.clear()
    window.location.replace("/auth/login")
  }, [queryClient])
}
