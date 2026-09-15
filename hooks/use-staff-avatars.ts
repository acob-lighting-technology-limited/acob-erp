"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

type StaffAvatarMap = Record<string, string>

const EMPTY: StaffAvatarMap = {}

async function fetchStaffAvatars(): Promise<StaffAvatarMap> {
  const response = await fetch("/api/staff/avatars", { credentials: "same-origin" })
  if (!response.ok) throw new Error("Failed to load staff avatars")
  const payload = (await response.json()) as { data?: StaffAvatarMap }
  return payload.data ?? EMPTY
}

/**
 * Org-wide `{ [profileId]: signedUrl }` map, fetched once and shared by every surface that
 * shows people. Signed URLs live an hour, so the cache refreshes well before they expire;
 * a URL that does expire still falls back to initials inside `StaffAvatar`.
 */
export function useStaffAvatars(): StaffAvatarMap {
  const queryClient = useQueryClient()

  // A photo upload/removal anywhere refreshes the map so the change shows everywhere.
  useEffect(() => {
    const handleChange = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffAvatars() })
    window.addEventListener("profile-avatar-changed", handleChange)
    return () => window.removeEventListener("profile-avatar-changed", handleChange)
  }, [queryClient])

  const { data } = useQuery({
    queryKey: QUERY_KEYS.staffAvatars(),
    queryFn: fetchStaffAvatars,
    staleTime: 30 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
    retry: 1,
  })

  return data ?? EMPTY
}
