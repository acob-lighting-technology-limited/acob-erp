import type { SupabaseClient } from "@supabase/supabase-js"

export interface MyProfile {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
  role: string | null
}

/** The signed-in user's profile basics. Works with the browser or the server client. */
export async function loadMyProfile(supabase: SupabaseClient, userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, department, role")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data as MyProfile
}
