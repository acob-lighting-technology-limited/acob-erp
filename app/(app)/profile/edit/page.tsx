"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ProfileForm } from "@/components/profile-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Get current user
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !authUser) {
        toast.error("Please log in to edit your profile")
        router.push("/auth/login")
        return
      }

      setUser(authUser)

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single()

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError
      }

      if (!profileData) {
        // Create a basic profile if it doesn't exist
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
            current_work_location: "",
            is_admin: false,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setProfile(newProfile)
      } else {
        setProfile(profileData)
      }
    } catch (error: any) {
      console.error("Error loading user data:", error)
      toast.error("Failed to load profile data")
    }
  }

  if (!user || !profile) {
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
