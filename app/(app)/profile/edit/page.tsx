"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ProfileForm } from "@/components/profile-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { QUERY_KEYS } from "@/lib/query-keys"
import { PageLoader } from "@/components/ui/query-states"
import type { Database } from "@/types/database"

type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"] & {
  email_notifications?: boolean | null
}

interface ProfileEditData {
  user: { id: string; email: string | undefined }
  profile: ProfileRecord | null
}

async function fetchProfileEditData(supabase: ReturnType<typeof createClient>): Promise<ProfileEditData> {
  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !authUser) throw new Error("Not authenticated")

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single()

  if (profileError && profileError.code !== "PGRST116") {
    throw new Error(profileError.message)
  }

  if (!profileData) {
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.id,
        company_email: authUser.email,
        first_name: "",
        last_name: "",
        other_names: "",
        department: "",
        company_role: "",
        phone_number: "",
        additional_phone: "",
        residential_address: "",
        office_location: "",
      })
      .select()
      .single()

    if (insertError) throw new Error(insertError.message)
    return { user: { id: authUser.id, email: authUser.email ?? undefined }, profile: newProfile as ProfileRecord }
  }

  return { user: { id: authUser.id, email: authUser.email ?? undefined }, profile: profileData as ProfileRecord }
}

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.profileEdit("me"),
    queryFn: () => fetchProfileEditData(supabase),
    retry: false,
  })

  if (isLoading) return <PageLoader />

  if (isError || !data) {
    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Profile not found</p>
              <Button onClick={() => router.push("/profile")} className="mt-4 w-full">
                Back to Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { user, profile } = data

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/profile")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-foreground text-3xl font-bold">Edit Profile</h1>
              <p className="text-muted-foreground">Update your personal and professional information</p>
            </div>
          </div>
        </div>

        <ProfileForm user={user} profile={profile} />
      </div>
    </div>
  )
}
