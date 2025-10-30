import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/profile-form"

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single()

  if (profileError || !profile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: data.user.id,
      company_email: data.user.email,
      first_name: "",
      last_name: "",
      other_names: "",
      department: "",
      company_role: "",
      phone_number: "",
      additional_phone: "",
      residential_address: "",
      current_work_location: "",
      site_name: "",
      site_state: "",
      device_allocated: "",
      device_type: "",
      device_model: "",
      is_admin: false,
    })

    if (insertError) {
      console.error("[v0] Profile creation error:", insertError)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Update your personal and professional information</p>
        </div>

        <ProfileForm user={data.user} profile={profile} />
      </div>
    </div>
  )
}
