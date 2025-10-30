import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboard } from "@/components/admin-dashboard"

export default async function AdminPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
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

    if (!insertError) {
      redirect("/dashboard")
    }
  }

  if (!profile?.is_admin) {
    redirect("/dashboard")
  }

  const { data: users } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })

  // Fetch all feedback to derive indicators and details per user
  const { data: allFeedback } = await supabase
    .from("feedback")
    .select("id, user_id, feedback_type, title, description, created_at")
    .order("created_at", { ascending: false })

  const feedbackByUserId: Record<string, any[]> = {}
  ;(allFeedback || []).forEach((f) => {
    if (!feedbackByUserId[f.user_id]) feedbackByUserId[f.user_id] = []
    feedbackByUserId[f.user_id].push(f)
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage staff members and view system data</p>
        </div>

        <AdminDashboard users={users || []} currentUserId={data.user.id} feedbackByUserId={feedbackByUserId} />
      </div>
    </div>
  )
}
