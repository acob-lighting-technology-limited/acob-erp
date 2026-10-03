"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"

export interface MyProfile {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
  role: string | null
}

async function fetchMyProfile(): Promise<MyProfile | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, department, role")
    .eq("id", user.id)
    .single()
  if (error) throw error
  return data as MyProfile
}

/**
 * The signed-in user's own profile basics, cached once for every screen that
 * needs "who am I / which department". Use this instead of calling
 * supabase.auth.getUser() + a profiles select inside a component effect.
 */
export function useMyProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.myProfile(),
    queryFn: fetchMyProfile,
    staleTime: 5 * 60 * 1000,
  })
}
